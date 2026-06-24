import { useMemo, useState } from 'react';
import {
  FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle,
} from '../data/chalkTheme.js';

/**
 * SauceBrowse — 2D selection surface for the Sauce Lab, drawn as a bistro
 * "specials board" in the shared kitchen-world chalk DNA (sibling of
 * CocktailBrowse). Mother-sauce families are the menu sections.
 *   • 77 sauces across 11 mother families (Béchamel, Velouté, Espagnole,
 *     Tomato, Hollandaise, Stir-fry, Curry, Nut Sauce, Mole, Salsa,
 *     Independent).
 *   • Filter axis is cuisine (15 distinct cuisines in the corpus).
 *   • No subclusters in the sauce data — each family is a flat list.
 */

// Pantry-shelf layout — 5 vessels per row, rows centered.
const PER_ROW = 5;
const SLOT_W = 144;
const ROW_H = 138;
const ROW_Y0 = 84;
const BOARD_W = PER_ROW * SLOT_W; // 720
const VESSEL_SCALE = 1.55;

// Centered {cx, cy} per family index + the row count (for viewBox sizing).
function computeLayout(n) {
  const positions = [];
  const rowCount = Math.max(1, Math.ceil(n / PER_ROW));
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / PER_ROW);
    const rowItems = Math.min(PER_ROW, n - r * PER_ROW);
    const k = i - r * PER_ROW;
    const startX = (BOARD_W - rowItems * SLOT_W) / 2 + SLOT_W / 2;
    positions.push({ cx: startX + k * SLOT_W, cy: ROW_Y0 + r * ROW_H });
  }
  return { positions, rowCount };
}

// Each mother family gets a DISTINCT signature vessel by name keyword (order
// matters; first hit wins). Generic gravy boat is the fallback.
const VESSEL_BY_FAMILY = [
  { rx: /b[ée]chamel/i,                          vessel: 'saucepan' }, // creamy → pot
  { rx: /velout|veloute/i,                        vessel: 'ladle' },    // stock → ladle
  { rx: /espagnole|demi|brown/i,                  vessel: 'boat' },     // brown → gravy boat
  { rx: /hollandaise|b[ée]arnaise|emulsion/i,     vessel: 'bowl' },     // whisked → mixing bowl
  { rx: /tomato|tomate|marinara|ketchup/i,        vessel: 'bottle' },   // condiment bottle
  { rx: /curry/i,                                 vessel: 'mortar' },   // mortar & pestle
  { rx: /stir.?fry|wok|soy|teriyaki/i,            vessel: 'wok' },      // wok
  { rx: /mole/i,                                  vessel: 'jug' },      // pitcher
  { rx: /salsa|pico|relish/i,                     vessel: 'jar' },      // mason jar
  { rx: /nut|peanut|satay|romesco|tahini/i,       vessel: 'carafe' },   // decanter
  { rx: /independent|misc|other|vinaigrette|oil/i, vessel: 'cruet' },   // cruet
];
function sauceVesselFor(name = '') {
  for (const { rx, vessel } of VESSEL_BY_FAMILY) if (rx.test(name)) return vessel;
  return 'boat';
}

/**
 * Draw a chalk sauce vessel centered horizontally at `bx`, standing on the
 * shelf at `by`. Returns SVG (liquid fill + chalk outline). Dashed when
 * inactive, solid when active.
 */
function vesselMark(kind, bx, by, color, stroke, active) {
  const fillOp = active ? 0.6 : 0.32;
  const sw = active ? 2.2 : 1.5;
  const dash = active ? '0' : '5 3';
  const fill = (d) => <path d={d} fill={color} fillOpacity={fillOp} stroke="none" />;
  const out = (d) => <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round" />;
  const dot = (cx, cy, r) => <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={sw} />;
  switch (kind) {
    case 'bottle': // condiment / ketchup bottle
      return (<>
        {fill(`M ${bx - 9} ${by - 12} L ${bx + 9} ${by - 12} L ${bx + 9} ${by - 1} L ${bx - 9} ${by - 1} Z`)}
        {out(`M ${bx - 11} ${by} L ${bx - 11} ${by - 30} Q ${bx - 11} ${by - 37} ${bx - 5} ${by - 39} L ${bx - 5} ${by - 45} L ${bx + 5} ${by - 45} L ${bx + 5} ${by - 39} Q ${bx + 11} ${by - 37} ${bx + 11} ${by - 30} L ${bx + 11} ${by} Z`)}
        {out(`M ${bx - 5} ${by - 45} L ${bx - 5} ${by - 50} L ${bx + 5} ${by - 50} L ${bx + 5} ${by - 45}`)}
      </>);
    case 'jar': // mason jar
      return (<>
        {fill(`M ${bx - 13} ${by - 14} L ${bx + 13} ${by - 14} L ${bx + 13} ${by - 1} L ${bx - 13} ${by - 1} Z`)}
        {out(`M ${bx - 15} ${by} L ${bx - 15} ${by - 30} L ${bx - 12} ${by - 35} L ${bx - 12} ${by - 40} L ${bx + 12} ${by - 40} L ${bx + 12} ${by - 35} L ${bx + 15} ${by - 30} L ${bx + 15} ${by} Z`)}
        {out(`M ${bx - 13} ${by - 40} L ${bx - 13} ${by - 47} L ${bx + 13} ${by - 47} L ${bx + 13} ${by - 40}`)}
      </>);
    case 'mortar': // mortar & pestle
      return (<>
        {fill(`M ${bx - 18} ${by - 20} Q ${bx} ${by + 2} ${bx + 18} ${by - 20} Z`)}
        {out(`M ${bx - 22} ${by - 22} L ${bx + 22} ${by - 22}`)}
        {out(`M ${bx - 20} ${by - 22} Q ${bx} ${by + 8} ${bx + 20} ${by - 22}`)}
        {out(`M ${bx - 9} ${by + 5} Q ${bx} ${by + 8} ${bx + 9} ${by + 5}`)}
        {out(`M ${bx + 7} ${by - 20} L ${bx + 19} ${by - 46}`)}
        {dot(bx + 19, by - 47, 3.2)}
      </>);
    case 'wok': // stir-fry pan
      return (<>
        {fill(`M ${bx - 19} ${by - 16} Q ${bx} ${by + 1} ${bx + 19} ${by - 16} Z`)}
        {out(`M ${bx - 24} ${by - 18} L ${bx + 22} ${by - 18}`)}
        {out(`M ${bx - 22} ${by - 18} Q ${bx} ${by + 6} ${bx + 22} ${by - 18}`)}
        {out(`M ${bx + 22} ${by - 18} L ${bx + 38} ${by - 22}`)}
      </>);
    case 'cruet': // narrow stoppered cruet
      return (<>
        {fill(`M ${bx - 7} ${by - 12} L ${bx + 7} ${by - 12} L ${bx + 7} ${by - 1} L ${bx - 7} ${by - 1} Z`)}
        {out(`M ${bx - 9} ${by} L ${bx - 9} ${by - 24} Q ${bx - 9} ${by - 31} ${bx - 4} ${by - 35} L ${bx - 4} ${by - 41} L ${bx + 4} ${by - 41} L ${bx + 4} ${by - 35} Q ${bx + 9} ${by - 31} ${bx + 9} ${by - 24} L ${bx + 9} ${by} Z`)}
        {dot(bx, by - 45, 3.4)}
      </>);
    case 'saucepan': // pot with lid + side handle
      return (<>
        {fill(`M ${bx - 16} ${by - 12} L ${bx + 16} ${by - 12} L ${bx + 16} ${by - 1} L ${bx - 16} ${by - 1} Z`)}
        {out(`M ${bx - 18} ${by} L ${bx - 18} ${by - 22} L ${bx + 18} ${by - 22} L ${bx + 18} ${by} Z`)}
        {out(`M ${bx - 20} ${by - 22} L ${bx + 20} ${by - 22}`)}
        {out(`M ${bx - 13} ${by - 22} Q ${bx} ${by - 35} ${bx + 13} ${by - 22}`)}
        {dot(bx, by - 35, 2.6)}
        {out(`M ${bx + 18} ${by - 16} L ${bx + 35} ${by - 18}`)}
      </>);
    case 'ladle': // cup bowl on a hooked handle
      return (<>
        {fill(`M ${bx - 11} ${by - 10} Q ${bx} ${by + 4} ${bx + 11} ${by - 10} Z`)}
        {out(`M ${bx - 13} ${by - 12} L ${bx + 13} ${by - 12}`)}
        {out(`M ${bx - 13} ${by - 12} Q ${bx} ${by + 8} ${bx + 13} ${by - 12}`)}
        {out(`M ${bx + 8} ${by - 11} L ${bx + 18} ${by - 44} Q ${bx + 18} ${by - 50} ${bx + 12} ${by - 49}`)}
      </>);
    case 'bowl': // wide mixing bowl + whisk
      return (<>
        {fill(`M ${bx - 20} ${by - 16} Q ${bx} ${by + 4} ${bx + 20} ${by - 16} Z`)}
        {out(`M ${bx - 23} ${by - 18} L ${bx + 23} ${by - 18}`)}
        {out(`M ${bx - 22} ${by - 18} Q ${bx} ${by + 9} ${bx + 22} ${by - 18}`)}
        {out(`M ${bx + 5} ${by - 16} L ${bx + 14} ${by - 44}`)}
        {out(`M ${bx + 1} ${by - 16} Q ${bx + 5} ${by - 8} ${bx + 9} ${by - 16}`)}
        {out(`M ${bx + 3} ${by - 19} Q ${bx + 6} ${by - 12} ${bx + 9} ${by - 19}`)}
      </>);
    case 'jug': // pitcher with spout + handle
      return (<>
        {fill(`M ${bx - 13} ${by - 12} L ${bx + 13} ${by - 12} L ${bx + 13} ${by - 1} L ${bx - 13} ${by - 1} Z`)}
        {out(`M ${bx - 15} ${by} L ${bx - 15} ${by - 26} Q ${bx - 15} ${by - 33} ${bx - 9} ${by - 35} L ${bx + 9} ${by - 35} Q ${bx + 15} ${by - 33} ${bx + 15} ${by - 26} L ${bx + 15} ${by} Z`)}
        {out(`M ${bx - 15} ${by - 31} L ${bx - 23} ${by - 35}`)}
        {out(`M ${bx + 15} ${by - 30} q 11 2 10 13 q -1 7 -10 6`)}
      </>);
    case 'carafe': // rounded decanter with stopper
      return (<>
        {fill(`M ${bx - 14} ${by - 14} Q ${bx - 15} ${by} ${bx} ${by} Q ${bx + 15} ${by} ${bx + 14} ${by - 14} Z`)}
        {out(`M ${bx - 6} ${by - 36} L ${bx - 6} ${by - 30} Q ${bx - 16} ${by - 24} ${bx - 16} ${by - 12} Q ${bx - 16} ${by} ${bx} ${by} Q ${bx + 16} ${by} ${bx + 16} ${by - 12} Q ${bx + 16} ${by - 24} ${bx + 6} ${by - 30} L ${bx + 6} ${by - 36} Z`)}
        {dot(bx, by - 39, 3.2)}
      </>);
    case 'boat': // gravy / sauce boat
    default:
      return (<>
        {fill(`M ${bx - 22} ${by - 16} Q ${bx} ${by + 3} ${bx + 20} ${by - 16} Z`)}
        {out(`M ${bx - 24} ${by - 18} L ${bx + 22} ${by - 18}`)}
        {out(`M ${bx - 24} ${by - 18} Q ${bx} ${by + 9} ${bx + 22} ${by - 18}`)}
        {out(`M ${bx + 22} ${by - 18} L ${bx + 33} ${by - 25}`)}
        {out(`M ${bx - 24} ${by - 17} q -9 1 -8 9 q 1 5 7 4`)}
        {out(`M ${bx - 9} ${by + 6} Q ${bx} ${by + 9} ${bx + 9} ${by + 6}`)}
      </>);
  }
}

// Word-wrap a family name into up to 2 lines for the chalk label (no cut).
function wrapName(name, max = 12) {
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
      if (m.has(node.family_id)) m.get(node.family_id).push(node);
      else m.set(node.family_id, [node]);
    }
    return m;
  }, [codexData, families]);

  // All cuisines in the corpus, alphabetized so chips don't reshuffle.
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
      <div className="flex items-center justify-center w-full h-full pt-10" style={chalkSurfaceStyle()}>
        <p className="text-base" style={{ fontFamily: FONT, color: CHALK_SUB }}>Chalking up the board…</p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 top-10 overflow-y-auto"
      style={{ ...chalkSurfaceStyle(), color: CHALK_CREAM, boxShadow: `inset 0 0 0 2px ${CHALK_RAIL}55, inset 0 0 0 4px #00000080` }}
      data-sauce-browse-root
    >
      {/* ───── Board header — the "specials board" title ───── */}
      <div className="px-4 pt-5 pb-2 max-w-4xl mx-auto text-center">
        <h1
          className="inline-block text-5xl sm:text-6xl pb-1.5"
          style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW, borderBottom: `2px solid ${CHALK_DIM}88` }}
        >
          Sauce Specials
        </h1>
        <p className="text-base mt-1.5" style={{ fontFamily: FONT, color: CHALK_SUB }}>
          Tap a family to filter · tap a sauce for the recipe
        </p>
      </div>

      {/* ───── Family board — colored chalk bubbles ───── */}
      <div className="px-4 pt-1 pb-2 max-w-4xl mx-auto">
        <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Mother families</div>
        {(() => {
          const { positions, rowCount } = computeLayout(families.length);
          const boardH = ROW_Y0 + (rowCount - 1) * ROW_H + 92;
          return (
            <svg viewBox={`0 0 ${BOARD_W} ${boardH}`} className="w-full h-auto" style={{ maxHeight: 440 }} role="img" aria-label="Sauce family pantry shelf">
              <title>Sauce families</title>
              {/* pantry shelves — one rail per row */}
              {Array.from({ length: rowCount }, (_, r) => {
                const sy = ROW_Y0 + r * ROW_H + 6;
                return (
                  <g key={`shelf-${r}`} pointerEvents="none">
                    <line x1="24" y1={sy} x2={BOARD_W - 24} y2={sy} stroke={`${CHALK_DIM}cc`} strokeWidth="3.5" strokeLinecap="round" />
                    <line x1="24" y1={sy + 5} x2={BOARD_W - 24} y2={sy + 5} stroke={`${CHALK_RAIL}99`} strokeWidth="2" strokeLinecap="round" />
                  </g>
                );
              })}
              {families.map((fam, i) => {
                const { cx, cy } = positions[i];
                const count = (byFamily.get(fam.id) || []).length;
                const active = filterFamily === fam.id;
                const dim = filterFamily != null && !active;
                const stroke = active ? CHALK_CREAM : fam.color;
                return (
                  <g
                    key={fam.id}
                    onClick={() => onFilterFamily(active ? null : fam.id)}
                    style={{ cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity .15s' }}
                    role="button"
                    aria-label={`${fam.name}, ${count} sauces`}
                  >
                    {/* full-slot hit area (thin chalk vessels are hard to tap) */}
                    <rect x={cx - 70} y={cy - 86} width="140" height="156" fill="transparent" />
                    <g transform={`translate(${cx} ${cy}) scale(${VESSEL_SCALE}) translate(${-cx} ${-cy})`} pointerEvents="none">
                      {vesselMark(sauceVesselFor(fam.name), cx, cy, fam.color, stroke, active)}
                    </g>
                    <text x={cx} y={cy + 30} textAnchor="middle" fontSize="20" fontFamily="Caveat, cursive" fill={active ? CHALK_CREAM : fam.color} pointerEvents="none">
                      {wrapName(fam.name).map((ln, li) => (
                        <tspan key={li} x={cx} dy={li === 0 ? 0 : 17}>{ln}</tspan>
                      ))}
                    </text>
                    <text x={cx} y={cy + 30 + (wrapName(fam.name).length > 1 ? 19 : 0) + 18} textAnchor="middle" fontSize="14" fontFamily="Caveat, cursive" fill={CHALK_CREAM} fillOpacity="0.6" pointerEvents="none">{count} sauces</text>
                  </g>
                );
              })}
            </svg>
          );
        })()}
        {filterFamily != null && (
          <div className="text-center -mt-1">
            <button type="button" onClick={() => onFilterFamily(null)} className="text-sm underline underline-offset-2" style={{ fontFamily: FONT, color: CHALK_DIM }}>
              Show all families
            </button>
          </div>
        )}
      </div>

      {/* ───── Filter bar — cuisine chalk chips + search ───── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md px-4 py-2.5 max-w-4xl mx-auto"
        style={{ background: '#0a0a0aE6', borderBottom: `1px solid ${CHALK_RAIL}66` }}
      >
        <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: CHALK_SUB }}>Cuisines</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[{ key: null, label: 'All Cuisines' }, ...cuisines.map((c) => ({ key: c, label: c }))].map((chip) => {
            const active = filterCuisine === chip.key;
            return (
              <button
                key={String(chip.key)}
                type="button"
                onClick={() => onFilterCuisine(active ? null : chip.key)}
                className="px-3 py-1 rounded-full text-[15px] border transition-colors"
                style={{
                  fontFamily: FONT,
                  color: active ? '#0a0a0a' : CHALK_CREAM,
                  background: active ? CHALK_CREAM : 'rgba(255,255,255,0.04)',
                  borderColor: active ? CHALK_CREAM : `${CHALK_RAIL}99`,
                  textShadow: active ? 'none' : CHALK_SHADOW,
                }}
              >
                {chip.label}
              </button>
            );
          })}
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
          const members = byFamily.get(fam.id) || [];
          const filtered = applyFilters(members);
          if (filtered.length === 0) return null;
          // Mother sauce first.
          filtered.sort((a, b) => (b.isRoot ? 1 : 0) - (a.isRoot ? 1 : 0));
          const famVessel = sauceVesselFor(fam.name);

          return (
            <section key={fam.id} className="mb-7">
              <header className="flex items-center gap-2.5 mb-2 py-1.5" style={{ borderTop: `1.5px solid ${fam.color}66`, borderBottom: `1.5px solid ${fam.color}66` }}>
                <svg width="42" height="36" viewBox="-8 2 80 72" aria-hidden="true" style={{ flexShrink: 0 }}>
                  {vesselMark(famVessel, 32, 58, fam.color, fam.color, true)}
                </svg>
                <h2 className="text-[36px] leading-none" style={{ fontFamily: FONT, color: fam.color, textShadow: CHALK_SHADOW }}>{fam.name}</h2>
                <span className="text-[14px]" style={{ fontFamily: FONT, color: CHALK_SUB }}>· {filtered.length} of {members.length}</span>
              </header>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-5">
                {filtered.map((s, idx) => {
                  const isSelected = selectedSauce === s.name;
                  return (
                    <li key={`${s.name}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => onSelectSauce(s.name)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors min-h-[38px]"
                        style={{
                          background: isSelected ? `${fam.color}22` : 'rgba(255,255,255,0.02)',
                          border: `1px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? `${fam.color}aa` : `${fam.color}55`}`,
                        }}
                      >
                        <svg width="22" height="18" viewBox="-8 6 80 66" aria-hidden="true" className="flex-shrink-0">
                          {vesselMark(famVessel, 32, 58, fam.color, fam.color, true)}
                        </svg>
                        <span className="flex-1 truncate text-[20px]" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>{s.name}</span>
                        {s.isRoot && (
                          <span className="text-[9px] rounded px-1 py-px tracking-wide" style={{ color: '#fde68a', border: '1px solid rgba(252,211,77,0.35)' }}>MOTHER</span>
                        )}
                        {s.cuisine && (
                          <span className="text-[11px]" style={{ color: CHALK_SUB }}>{s.cuisine}</span>
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
          <div className="text-center text-base py-12" style={{ fontFamily: FONT, color: CHALK_SUB }}>
            No sauces match these filters.{' '}
            <button
              type="button"
              onClick={() => { onFilterFamily(null); onFilterCuisine(null); setSearchTerm(''); }}
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
