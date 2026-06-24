import { useMemo, useState } from 'react';
import { cocktailBaseSpirit, COCKTAIL_SPIRIT_LEGEND, COCKTAIL_SPIRIT_COLORS } from '../data/cocktailBaseSpirit.js';

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


// Word-wrap a family name into up to 2 lines for the shelf tag (no truncation).
function wrapFamilyName(name, max = 11) {
  const words = String(name || '').trim().split(/\s+/);
  if (words.length <= 1) return [name || ''];
  const lines = [''];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (!last) lines[lines.length - 1] = w;
    else if ((last + ' ' + w).length <= max) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return lines.slice(0, 2);
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

// Each cocktail family gets a signature glass. Matched by name keyword;
// order matters (boozy/sipper before the generic stirred match).
const GLASS_BY_FAMILY = [
  { rx: /tropical/i,            glass: 'pilsner' },  // tall vaso cervecero
  { rx: /highball|fizz/i,       glass: 'snifter' },  // brandy balloon
  { rx: /sour/i,                glass: 'margarita' },
  { rx: /boozy|sipper|rocks/i,  glass: 'rocks' },
  { rx: /aromatic|stir/i,       glass: 'martini' },
  { rx: /aperitivo|spritz/i,    glass: 'wine' },
];
function glassTypeFor(name = '') {
  for (const { rx, glass } of GLASS_BY_FAMILY) if (rx.test(name)) return glass;
  return 'coupe';
}

/**
 * Render a chalk glass silhouette for a family, centered at `cx`, standing on
 * the shelf at y≈104. Returns SVG elements (liquid fill + chalk outline, plus
 * a stem/foot for stemware). Dashed stroke when inactive, solid when active.
 */
function glassMark(type, cx, color, stroke, active) {
  const liquid = (d) => <path d={d} fill={color} fillOpacity={active ? 0.62 : 0.34} stroke="none" />;
  const glass = (d) => (
    <path d={d} fill="none" stroke={stroke} strokeWidth={active ? 2.4 : 1.6}
      strokeDasharray={active ? '0' : '5 3'} strokeLinejoin="round" strokeLinecap="round" />
  );
  const stick = (x1, y1, x2, y2) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={active ? 2.4 : 1.6} strokeLinecap="round" />
  );
  switch (type) {
    case 'pilsner': // tall tapered beer/vaso-cervecero glass
      return (<>
        {liquid(`M ${cx - 9} 48 L ${cx + 9} 48 L ${cx + 6} 103 L ${cx - 6} 103 Z`)}
        {glass(`M ${cx - 11} 22 L ${cx + 11} 22 L ${cx + 6} 104 L ${cx - 6} 104 Z`)}
      </>);
    case 'snifter': // brandy balloon — round bowl, incurved rim, short stem
      return (<>
        {liquid(`M ${cx - 13} 66 Q ${cx - 14} 80 ${cx} 82 Q ${cx + 14} 80 ${cx + 13} 66 Q ${cx + 7} 72 ${cx} 72 Q ${cx - 7} 72 ${cx - 13} 66 Z`)}
        {glass(`M ${cx - 8} 48 Q ${cx - 19} 56 ${cx - 17} 72 Q ${cx - 15} 88 ${cx} 90 Q ${cx + 15} 88 ${cx + 17} 72 Q ${cx + 19} 56 ${cx + 8} 48`)}
        {stick(cx, 90, cx, 100)}{stick(cx - 11, 102, cx + 11, 102)}
      </>);
    case 'margarita': // wide flared bowl with a stepped waist, on a stem
      return (<>
        {liquid(`M ${cx - 15} 47 Q ${cx - 12} 55 ${cx} 57 Q ${cx + 12} 55 ${cx + 15} 47 Z`)}
        {glass(`M ${cx - 23} 40 Q ${cx - 20} 52 ${cx - 7} 58 L ${cx - 9} 63 Q ${cx - 9} 67 ${cx} 67 Q ${cx + 9} 67 ${cx + 9} 63 L ${cx + 7} 58 Q ${cx + 20} 52 ${cx + 23} 40`)}
        {stick(cx, 67, cx, 101)}{stick(cx - 14, 102, cx + 14, 102)}
      </>);
    case 'highball':
      return (<>
        {liquid(`M ${cx - 10} 56 L ${cx + 10} 56 L ${cx + 8.5} 103 L ${cx - 8.5} 103 Z`)}
        {glass(`M ${cx - 11} 28 L ${cx + 11} 28 L ${cx + 8.5} 104 L ${cx - 8.5} 104 Z`)}
      </>);
    case 'rocks':
      return (<>
        {liquid(`M ${cx - 14} 82 L ${cx + 14} 82 L ${cx + 13} 103 L ${cx - 13} 103 Z`)}
        {glass(`M ${cx - 15} 64 L ${cx + 15} 64 L ${cx + 13} 104 L ${cx - 13} 104 Z`)}
      </>);
    case 'martini':
      return (<>
        {liquid(`M ${cx - 12} 46 L ${cx + 12} 46 L ${cx} 63 Z`)}
        {glass(`M ${cx - 22} 38 L ${cx + 22} 38 L ${cx} 74 Z`)}
        {stick(cx, 74, cx, 101)}{stick(cx - 13, 102, cx + 13, 102)}
      </>);
    case 'coupe':
      return (<>
        {liquid(`M ${cx - 13} 47 Q ${cx} 60 ${cx + 13} 47 Z`)}
        {glass(`M ${cx - 20} 43 L ${cx + 20} 43 Q ${cx} 71 ${cx - 20} 43 Z`)}
        {stick(cx, 65, cx, 101)}{stick(cx - 13, 102, cx + 13, 102)}
      </>);
    case 'wine':
      return (<>
        {liquid(`M ${cx - 10} 50 Q ${cx - 10} 62 ${cx} 64 Q ${cx + 10} 62 ${cx + 10} 50 Z`)}
        {glass(`M ${cx - 13} 38 Q ${cx - 15} 62 ${cx} 66 Q ${cx + 15} 62 ${cx + 13} 38 Z`)}
        {stick(cx, 66, cx, 101)}{stick(cx - 12, 102, cx + 12, 102)}
      </>);
    case 'hurricane':
    default:
      return (<>
        {liquid(`M ${cx - 9.5} 60 Q ${cx - 11} 84 ${cx - 6} 103 L ${cx + 6} 103 Q ${cx + 11} 84 ${cx + 9.5} 60 Q ${cx} 64 ${cx - 9.5} 60 Z`)}
        {glass(`M ${cx - 11} 32 Q ${cx - 16} 56 ${cx - 9} 76 Q ${cx - 12} 95 ${cx - 6} 104 L ${cx + 6} 104 Q ${cx + 12} 95 ${cx + 9} 76 Q ${cx + 16} 56 ${cx + 11} 32 Z`)}
      </>);
  }
}

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
          className="inline-block text-5xl sm:text-6xl pb-1.5"
          style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW, borderBottom: `2px solid ${CHALK_DIM}88` }}
        >
          Cocktail Menu
        </h1>
        <p className="text-base mt-1.5" style={{ fontFamily: FONT, color: CHALK_SUB }}>
          Tap a family to filter · tap a drink for the recipe
        </p>
      </div>

      {/* ───── Back-bar shelf — one chalk bottle per family ───── */}
      <div className="px-4 pt-1 pb-2 max-w-4xl mx-auto">
        <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Families</div>
        <svg
          viewBox={`0 -12 ${graph.families.length * 110} 182`}
          className="w-full h-auto"
          style={{ maxHeight: 224 }}
          role="img"
          aria-label="Cocktail families — back-bar shelf"
        >
          <title>Cocktail families</title>
          {/* the shelf */}
          <line x1="6" y1="104" x2={graph.families.length * 110 - 6} y2="104" stroke={`${CHALK_DIM}cc`} strokeWidth="3" strokeLinecap="round" />
          <line x1="6" y1="108" x2={graph.families.length * 110 - 6} y2="108" stroke={`${CHALK_RAIL}99`} strokeWidth="1.5" strokeLinecap="round" />
          {graph.families.map((fam, i) => {
            const cx = 55 + i * 110;
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
                <rect x={cx - 54} y="-12" width="108" height="170" fill="transparent" />
                {/* the family's signature glass, scaled up about the shelf base */}
                <g transform={`translate(${cx} 104) scale(1.3) translate(${-cx} -104)`} pointerEvents="none">
                  {glassMark(glassTypeFor(fam.name), cx, fam.color, stroke, active)}
                </g>
                {/* family name on a shelf tag below (wrapped, not cut) + count */}
                <text x={cx} y="123" textAnchor="middle" fontSize="22" fontFamily="Caveat, cursive" fill={active ? CHALK_CREAM : fam.color} pointerEvents="none">
                  {wrapFamilyName(fam.name).map((ln, li) => (
                    <tspan key={li} x={cx} dy={li === 0 ? 0 : 18}>{ln}</tspan>
                  ))}
                </text>
                <text x={cx} y="160" textAnchor="middle" fontSize="15" fontFamily="Caveat, cursive" fill={CHALK_CREAM} fillOpacity="0.6" pointerEvents="none">{count} drinks</text>
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

      {/* ───── Filter bar — chalk-outline spirit chips ───── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md px-4 py-2.5 max-w-4xl mx-auto"
        style={{ background: '#0a0a0aE6', borderBottom: `1px solid ${CHALK_RAIL}66` }}
      >
        <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: CHALK_SUB }}>Spirits</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SPIRIT_CHIPS.map((chip) => {
            const active = filterSpirit === chip.key;
            // Color-code each spirit by its back-bar pour color. "All Spirits"
            // (key null) stays neutral cream. Active = filled with the color;
            // inactive = a colored chalk dot + colored outline.
            const c = chip.key ? COCKTAIL_SPIRIT_COLORS[chip.key] : null;
            return (
              <button
                key={String(chip.key)}
                type="button"
                onClick={() => onFilterSpirit(active ? null : chip.key)}
                className="px-3 py-1 rounded-full text-[15px] border transition-colors inline-flex items-center gap-1.5"
                style={{
                  fontFamily: FONT,
                  color: active ? '#0a0a0a' : (c || CHALK_CREAM),
                  background: active ? (c || CHALK_CREAM) : 'rgba(255,255,255,0.04)',
                  borderColor: active ? (c || CHALK_CREAM) : `${c || CHALK_RAIL}99`,
                  textShadow: active ? 'none' : CHALK_SHADOW,
                }}
              >
                {c && (
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 8, height: 8, background: active ? '#0a0a0a55' : c }}
                    aria-hidden="true"
                  />
                )}
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
