import { useMemo, useState } from 'react';

/**
 * SauceBrowse — 2D selection surface for the Sauce Lab. Sibling of
 * CocktailBrowse; same Pattern-D structure (mini-map + filter bar +
 * sectioned list) adapted for the smaller sauce dataset:
 *   • 77 sauces across 11 mother families (Béchamel, Velouté,
 *     Espagnole, Tomato, Hollandaise, Stir-fry, Curry, Nut Sauce,
 *     Mole, Salsa, Independent).
 *   • Filter axis is cuisine (15 distinct cuisines in the corpus)
 *     rather than alcohol type.
 *   • No subcluster sub-headers (sauce data doesn't carry them) —
 *     each family renders as a flat list.
 */

const MAP_VIEWBOX = '0 0 720 320';
// 4-4-3 layout for up to 11 families. Extra slots fall through with
// no bubble drawn.
const FAMILY_GRID = [
  { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 },
  { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 },
  { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 3, row: 2 },
];
const COL_X = [110, 305, 500, 660];
const ROW_Y = [70, 175, 275];
// Smaller-than-cocktail bubbles since sauce families top out at 27
// members — without scaling the visual is too uniform.
const BUBBLE_R_BASE = 16;
const BUBBLE_R_SCALE = 3.6;

function bubbleRadius(count) {
  return BUBBLE_R_BASE + Math.sqrt(count) * BUBBLE_R_SCALE;
}

function bubbleShortName(name) {
  if (!name) return '';
  if (name.length <= 12) return name;
  return name.slice(0, 11) + '…';
}

export default function SauceBrowse({
  codexData,
  selectedSauce,
  onSelectSauce,
  filterFamily,
  onFilterFamily,
  filterCuisine,
  onFilterCuisine,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const families = codexData?.codex?.clusters || [];

  // Group sauces by family_id once so per-family filtering is cheap.
  const byFamily = useMemo(() => {
    if (!codexData?.graph?.nodes) return new Map();
    const m = new Map();
    for (const fam of families) m.set(fam.id, []);
    for (const node of codexData.graph.nodes.values()) {
      if (m.has(node.family_id)) {
        m.get(node.family_id).push(node);
      } else {
        m.set(node.family_id, [node]);
      }
    }
    return m;
  }, [codexData, families]);

  // All cuisines that appear in the corpus, in alphabetical order so
  // the chips don't reshuffle as filters change.
  const cuisines = useMemo(() => {
    if (!codexData?.graph?.nodes) return [];
    const set = new Set();
    for (const n of codexData.graph.nodes.values()) {
      if (n.cuisine) set.add(n.cuisine);
    }
    return [...set].sort();
  }, [codexData]);

  const familiesToRender = useMemo(() => {
    if (filterFamily == null) return families;
    return families.filter((f) => f.id === filterFamily);
  }, [families, filterFamily]);

  const applyFilters = (members) => {
    const term = searchTerm.trim().toLowerCase();
    return members.filter((m) => {
      if (filterCuisine && m.cuisine !== filterCuisine) return false;
      if (term && !m.name.toLowerCase().includes(term)) return false;
      return true;
    });
  };

  if (!codexData) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <p className="text-neural-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 top-10 overflow-y-auto bg-neural-bg text-neural-text" data-sauce-browse-root>
      {/* ───── Mini-map ───── */}
      <div className="px-4 pt-4 pb-2 max-w-4xl mx-auto">
        <svg viewBox={MAP_VIEWBOX} className="w-full h-auto" role="img" aria-label="Sauce family map">
          <title>Sauce family map</title>
          {families.map((fam, i) => {
            const slot = FAMILY_GRID[i];
            if (!slot) return null;
            const cx = COL_X[slot.col];
            const cy = ROW_Y[slot.row];
            const count = (byFamily.get(fam.id) || []).length;
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
          <button
            type="button"
            onClick={() => onFilterCuisine(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
              filterCuisine == null
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                : 'bg-[#12121a] border-[#2a2a3a] text-gray-400 hover:text-gray-200 hover:border-[#3a3a4a]'
            }`}
          >
            All Cuisines
          </button>
          {cuisines.map((c) => {
            const active = filterCuisine === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onFilterCuisine(active ? null : c)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                    : 'bg-[#12121a] border-[#2a2a3a] text-gray-400 hover:text-gray-200 hover:border-[#3a3a4a]'
                }`}
              >
                {c}
              </button>
            );
          })}
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
          const members = byFamily.get(fam.id) || [];
          const filtered = applyFilters(members);
          if (filtered.length === 0) return null;
          // Show root sauce first if present.
          filtered.sort((a, b) => (b.isRoot ? 1 : 0) - (a.isRoot ? 1 : 0));

          return (
            <section key={fam.id} className="mb-5">
              <header className="flex items-baseline gap-2 mb-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ background: fam.color }}
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-white">{fam.name}</h2>
                <span className="text-[11px] text-gray-500">{filtered.length} of {members.length}</span>
              </header>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filtered.map((s, idx) => {
                  const isSelected = selectedSauce === s.name;
                  return (
                    <li key={`${s.name}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => onSelectSauce(s.name)}
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
                        <span className="flex-1 truncate">{s.name}</span>
                        {s.isRoot && (
                          <span className="text-[9px] text-amber-300/80 border border-amber-400/30 rounded px-1 py-px tracking-wide">MOTHER</span>
                        )}
                        {s.cuisine && (
                          <span className="text-[9px] text-gray-500">{s.cuisine}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {familiesToRender.every((f) => applyFilters(byFamily.get(f.id) || []).length === 0) && (
          <div className="text-center text-sm text-gray-500 py-12">
            No sauces match these filters.{' '}
            <button
              type="button"
              onClick={() => { onFilterFamily(null); onFilterCuisine(null); setSearchTerm(''); }}
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
