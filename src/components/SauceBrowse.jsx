import { useMemo, useState } from 'react';
import {
  FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle,
} from '../data/chalkTheme.js';
import { parseQuery, matchItem, buildIngredientVocab } from '../data/ingredientSearch.js';
import { popColor, sauceVesselFor, vesselMark } from './sauceVessels.jsx';

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
  // My pantry / Invent entry points (optional — buttons hidden without them).
  pantryCount = 0,
  onOpenPantry = null,
  onOpenInvent = null,
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

  // Search matches sauce names AND ingredients ("tomato, basil" = both).
  // Map of sauce name → matched ingredient strings; null = no search.
  const searchHits = useMemo(() => {
    const terms = parseQuery(searchTerm);
    if (!codexData?.graph?.nodes || terms.length === 0) return null;
    const hits = new Map();
    for (const n of codexData.graph.nodes.values()) {
      const r = matchItem({ name: n.name, ingredients: n.ingredients }, terms);
      if (r.match) hits.set(n.name, r.hits);
    }
    return hits;
  }, [codexData, searchTerm]);

  const ingredientVocab = useMemo(() => {
    if (!codexData?.graph?.nodes) return [];
    return buildIngredientVocab([...codexData.graph.nodes.values()].map((n) => n.ingredients));
  }, [codexData]);

  const applyFilters = (members) => members.filter((m) => {
    if (filterCuisine && m.cuisine !== filterCuisine) return false;
    if (searchHits && !searchHits.has(m.name)) return false;
    return true;
  });

  const matchCount = useMemo(() => {
    if (!codexData?.graph?.nodes) return 0;
    let n = 0;
    for (const m of codexData.graph.nodes.values()) {
      if (filterFamily != null && m.family_id !== filterFamily) continue;
      if (filterCuisine && m.cuisine !== filterCuisine) continue;
      if (searchHits && !searchHits.has(m.name)) continue;
      n += 1;
    }
    return n;
  }, [codexData, filterFamily, filterCuisine, searchHits]);

  if (!codexData) {
    return (
      <div className="flex items-center justify-center w-full h-full pt-10" style={chalkSurfaceStyle()}>
        <p className="text-base" style={{ fontFamily: FONT, color: CHALK_SUB }}>Chalking up the board…</p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-x-0 top-0 overflow-y-auto"
      // v1.0.2/3: bottom stops above the fixed tab bar (inset-0 hid the last ~57px);
      // top-0 instead of top-10 — the top nav it reserved space for is hidden.
      style={{ bottom: 'var(--tab-bar-h)', paddingTop: 'env(safe-area-inset-top, 0px)', ...chalkSurfaceStyle(), color: CHALK_CREAM, boxShadow: `inset 0 0 0 2px ${CHALK_RAIL}55, inset 0 0 0 4px #00000080` }}
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
          const boardH = ROW_Y0 + (rowCount - 1) * ROW_H + 100;
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
                    <text x={cx} y={cy + 32} textAnchor="middle" fontSize="28" fontFamily="Caveat, cursive" fill={active ? CHALK_CREAM : fam.color} pointerEvents="none">
                      {wrapName(fam.name).map((ln, li) => (
                        <tspan key={li} x={cx} dy={li === 0 ? 0 : 30}>{ln}</tspan>
                      ))}
                    </text>
                    <text x={cx} y={cy + 32 + (wrapName(fam.name).length > 1 ? 30 : 0) + 24} textAnchor="middle" fontSize="26" fontFamily="Caveat, cursive" fill={CHALK_CREAM} fillOpacity="0.75" pointerEvents="none">{count} sauces</text>
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
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search sauce or ingredient — e.g. tomato, basil"
          aria-label="Search sauces by name or ingredient"
          list="sauce-ingredient-vocab"
          data-sauce-search
          className="w-full px-2.5 py-1.5 rounded-md focus:outline-none text-[16px] mb-1"
          style={{ fontFamily: FONT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
        />
        <datalist id="sauce-ingredient-vocab">
          {ingredientVocab.map((v) => <option key={v} value={v} />)}
        </datalist>
        {(onOpenPantry || onOpenInvent) && (
          <div className="mt-1 mb-2 flex flex-wrap items-center gap-2">
            {onOpenPantry && (
              <button type="button" onClick={onOpenPantry} data-testid="sauce-pantry-open"
                className="px-3 py-1 rounded-full border min-h-[44px] text-[17px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ fontFamily: FONT, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
                🧺 My pantry{pantryCount ? ` (${pantryCount})` : ''}
              </button>
            )}
            {onOpenInvent && (
              <button type="button" onClick={onOpenInvent} data-testid="sauce-invent-open"
                className="px-3 py-1 rounded-full border min-h-[44px] text-[17px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ fontFamily: FONT, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
                ✨ Invent a sauce
              </button>
            )}
          </div>
        )}
        {searchHits && (
          <p className="mb-1.5 text-[13px]" style={{ color: CHALK_SUB }} aria-live="polite">
            {matchCount} sauce{matchCount === 1 ? '' : 's'} match “{searchTerm.trim()}” · separate ingredients with commas to combine
          </p>
        )}
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
                          // v1.0.3: each sauce card carries a wash of its mother-family colour.
                          // v1.0.4: stronger mother-family wash, full-strength outline with a soft glow.
                          background: isSelected
                            ? `linear-gradient(135deg, ${fam.color}55, ${fam.color}2a)`
                            : `linear-gradient(135deg, ${fam.color}36, ${fam.color}16)`,
                          border: `1.5px solid ${isSelected ? CHALK_CREAM : popColor(fam.color)}`,
                          boxShadow: isSelected
                            ? `0 0 0 1px ${fam.color}, 0 0 14px ${fam.color}88, 0 2px 8px rgba(0,0,0,0.4)`
                            : `0 0 10px ${fam.color}55, 0 2px 6px rgba(0,0,0,0.35)`,
                        }}
                      >
                        <svg width="22" height="18" viewBox="-8 6 80 66" aria-hidden="true" className="flex-shrink-0">
                          {vesselMark(famVessel, 32, 58, fam.color, fam.color, true)}
                        </svg>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-[20px]" style={{ fontFamily: FONT, color: isSelected ? CHALK_CREAM : popColor(fam.color), textShadow: `0 0 6px ${fam.color}66, ${CHALK_SHADOW}` }}>{s.name}</span>
                          {searchHits?.get(s.name)?.length > 0 && (
                            <span className="block truncate text-[11px]" style={{ color: CHALK_DIM }} data-search-hit>
                              with {searchHits.get(s.name).join(', ')}
                            </span>
                          )}
                        </span>
                        {s.isRoot && (
                          <span className="text-[9px] rounded px-1 py-px tracking-wide" style={{ color: '#fde68a', border: '1px solid rgba(252,211,77,0.35)' }}>MOTHER</span>
                        )}
                        {s.cuisine && (
                          <span className="text-[11px]" style={{ color: CHALK_DIM }}>{s.cuisine}</span>
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
