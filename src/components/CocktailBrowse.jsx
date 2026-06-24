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

// Per-spirit bottle geometry — the silhouette varies by booze so the shelf
// reads like a real back bar (square-shouldered gin, broad whiskey, round
// rum, slim vodka, long-neck tequila, squat liqueur, sloped champagne…).
// All bottles stand on the shelf at base=103; y grows downward.
const BOTTLE_BASE = 103;
// bodyW = half-width at base · bodyTopW = half-width where the body meets the
// shoulder (taper) · bodyStyle: 'straight'|'taper'|'bulge' · punt: concave base
// (wine) · labelAngle: degrees to tilt the paper label.
const BOTTLE_PARAMS = {
  gin:      { bodyW: 15, bodyTopW: 15, bodyTop: 54, neckW: 5,   shoulderTop: 44, capW: 6.5, capTop: 16, capBot: 24, shoulder: 'square', labelAngle: -15, labelMode: 'skew', scale: 0.9 },
  whiskey:  { bodyW: 19, bodyTopW: 17, bodyTop: 60, neckW: 5.5, shoulderTop: 50, capW: 7.5, capTop: 24, capBot: 32, shoulder: 'round',  bodyStyle: 'taper' },
  rum:      { bodyW: 17, bodyTopW: 14, bodyTop: 58, neckW: 5.5, shoulderTop: 46, capW: 7,   capTop: 20, capBot: 28, shoulder: 'round',  bodyStyle: 'bulge' },
  vodka:    { bodyW: 13, bodyTopW: 13, bodyTop: 50, neckW: 4.5, shoulderTop: 40, capW: 6,   capTop: 14, capBot: 22, shoulder: 'sloped', labelAngle: -13, labelMode: 'skew' },
  tequila:  { bodyW: 21, bodyTopW: 20, bodyTop: 70, neckW: 6.5, shoulderTop: 58, capW: 8.5, capTop: 36, capBot: 44, shoulder: 'round' }, // squat — a touch longer + wider, upright label
  liqueur:  { bodyW: 18, bodyTopW: 16, bodyTop: 66, neckW: 6,   shoulderTop: 56, capW: 8,   capTop: 30, capBot: 38, shoulder: 'round',  bodyStyle: 'bulge' },
  vermouth: { bodyW: 12, bodyTopW: 12, bodyTop: 50, neckW: 4.5, shoulderTop: 36, capW: 6,   capTop: 14, capBot: 22, shoulder: 'sloped' },
  wine:     { bodyW: 13, bodyTopW: 13, bodyTop: 56, neckW: 4.5, shoulderTop: 46, capW: 5.5, capTop: 14, capBot: 20, shoulder: 'round',  punt: true }, // long neck + punt
  other:    { bodyW: 16, bodyTopW: 15, bodyTop: 56, neckW: 5.5, shoulderTop: 48, capW: 6.5, capTop: 24, capBot: 32, shoulder: 'round' },
};

/**
 * Render a chalk bottle silhouette for a spirit, centered at `cx`, standing
 * on the shelf at y≈103. Returns SVG elements (liquid fill + chalk outline +
 * a paper label bearing the spirit's name). Dashed stroke when inactive,
 * solid when active.
 */
function bottleMark(spirit, cx, color, stroke, active, name) {
  const p = BOTTLE_PARAMS[spirit] || BOTTLE_PARAMS.other;
  const { bodyW, bodyTop, neckW, shoulderTop, capW, capTop, capBot, shoulder } = p;
  const bodyTopW = p.bodyTopW ?? bodyW;
  const bodyStyle = p.bodyStyle || 'straight';
  const base = BOTTLE_BASE;
  const midY = (base + bodyTop) / 2;

  // Body walls — straight, tapered (narrower at shoulder) or bulged (rounder).
  const leftWall = bodyStyle === 'bulge'
    ? `Q ${cx - bodyW - 3} ${midY} ${cx - bodyTopW} ${bodyTop}`
    : `L ${cx - bodyTopW} ${bodyTop}`;
  const rightWall = bodyStyle === 'bulge'
    ? `Q ${cx + bodyW + 3} ${midY} ${cx + bodyW} ${base}`
    : `L ${cx + bodyW} ${base}`;

  // Shoulders — from body-top width up to the neck.
  const leftShoulder =
    shoulder === 'square' ? `L ${cx - bodyTopW} ${shoulderTop} L ${cx - neckW} ${shoulderTop}`
    : shoulder === 'round' ? `Q ${cx - bodyTopW} ${shoulderTop} ${cx - neckW} ${shoulderTop}`
    : `L ${cx - neckW} ${shoulderTop}`; // sloped — long diagonal (champagne/slim)
  const rightShoulder =
    shoulder === 'square' ? `L ${cx + bodyTopW} ${shoulderTop} L ${cx + bodyTopW} ${bodyTop}`
    : shoulder === 'round' ? `Q ${cx + bodyTopW} ${shoulderTop} ${cx + bodyTopW} ${bodyTop}`
    : `L ${cx + bodyTopW} ${bodyTop}`;

  // Base — flat, or a concave punt (wine).
  const bottom = p.punt ? `Q ${cx} ${base - 6} ${cx - bodyW} ${base}` : '';

  const outline = [
    `M ${cx - bodyW} ${base}`,
    leftWall,
    leftShoulder,
    `L ${cx - neckW} ${capBot}`,
    `L ${cx - capW} ${capBot}`,
    `L ${cx - capW} ${capTop}`,
    `L ${cx + capW} ${capTop}`,
    `L ${cx + capW} ${capBot}`,
    `L ${cx + neckW} ${capBot}`,
    `L ${cx + neckW} ${shoulderTop}`,
    rightShoulder,
    rightWall,
    bottom,
    'Z',
  ].join(' ');

  const innerW = Math.min(bodyW, bodyTopW) - 2;
  const fillY = bodyTop + 7;
  const fillBot = base - (p.punt ? 4 : 1);
  const liquid = `M ${cx - innerW} ${fillY} L ${cx + innerW} ${fillY} L ${cx + innerW} ${fillBot} L ${cx - innerW} ${fillBot} Z`;

  // Paper label across the lower body — cream stock, ink text, optionally
  // tilted. A real pasted-on bottle label rather than a chalk outline.
  // 'rotate' spins the whole label (corners may overhang the walls);
  // 'skew' shears it into a rhombus whose left/right edges stay vertical
  // and flush to the bottle walls (corners never drift past the outline).
  const angle = p.labelAngle || 0;
  const labelMode = p.labelMode || 'rotate';
  // Rotated labels get a little extra width to span the tilt; skewed ones
  // stay exactly body-width so the vertical edges hug the walls.
  const ext = angle && labelMode === 'rotate' ? 6 : 0;
  const labelW = (Math.min(bodyW, bodyTopW) - 1.5) * 2 + ext;
  const labelH = 19;
  const labelCY = bodyTop + (base - bodyTop) * 0.52;
  const labelTop = labelCY - labelH / 2;
  const labelLeft = cx - labelW / 2;
  const labelTransform = !angle ? undefined
    : labelMode === 'skew' ? `translate(${cx} 0) skewY(${angle}) translate(${-cx} 0)`
    : `rotate(${angle} ${cx} ${labelCY})`;
  return (<>
    <path d={liquid} fill={color} fillOpacity={active ? 0.62 : 0.34} stroke="none" />
    <path d={outline} fill="none" stroke={stroke} strokeWidth={active ? 2.4 : 1.6}
      strokeDasharray={active ? '0' : '5 3'} strokeLinejoin="round" strokeLinecap="round" />
    {/* the paper label (tilted for some spirits) */}
    <g transform={labelTransform}>
      <rect x={labelLeft} y={labelTop} width={labelW} height={labelH} rx="2.5"
        fill={CHALK_CREAM} fillOpacity={active ? 0.96 : 0.85}
        stroke={stroke} strokeWidth="1" strokeOpacity={active ? 0.95 : 0.6} />
      {name && (
        <text x={cx} y={labelCY + 0.5} textAnchor="middle" dominantBaseline="central"
          fontSize="14" fontFamily="Caveat, cursive" fontWeight="700" fill="#211e18"
          textLength={labelW - 6} lengthAdjust="spacingAndGlyphs" pointerEvents="none">{name}</text>
      )}
    </g>
  </>);
}

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
          viewBox={`0 -30 ${graph.families.length * 110} 200`}
          className="w-full h-auto"
          style={{ maxHeight: 256 }}
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
                <rect x={cx - 54} y="-30" width="108" height="192" fill="transparent" />
                {/* the family's signature glass, scaled up about the shelf base */}
                <g transform={`translate(${cx} 104) scale(1.5) translate(${-cx} -104)`} pointerEvents="none">
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

      {/* ───── Back-bar bottle shelf — one chalk bottle per base spirit ───── */}
      <div className="px-4 pt-1 pb-2 max-w-4xl mx-auto">
        <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Spirits</div>
        <svg
          viewBox={`0 -50 ${SPIRIT_SHELF.length * 112} 186`}
          className="w-full h-auto"
          style={{ maxHeight: 288 }}
          role="img"
          aria-label="Base spirits — back-bar bottle shelf"
        >
          <title>Base spirits</title>
          {/* the shelf */}
          <line x1="6" y1="104" x2={SPIRIT_SHELF.length * 112 - 6} y2="104" stroke={`${CHALK_DIM}cc`} strokeWidth="3" strokeLinecap="round" />
          <line x1="6" y1="108" x2={SPIRIT_SHELF.length * 112 - 6} y2="108" stroke={`${CHALK_RAIL}99`} strokeWidth="1.5" strokeLinecap="round" />
          {SPIRIT_SHELF.map((s, i) => {
            const cx = 56 + i * 112;
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
                <rect x={cx - 55} y="-50" width="110" height="174" fill="transparent" />
                {/* per-bottle scale: everything bumped up except gin (held smaller) */}
                <g transform={`translate(${cx} 104) scale(${1.65 * (BOTTLE_PARAMS[s.key]?.scale ?? 1)}) translate(${-cx} -104)`} pointerEvents="none">
                  {bottleMark(s.key, cx, color, stroke, active, s.label)}
                </g>
                <text x={cx} y="128" textAnchor="middle" fontSize="15" fontFamily="Caveat, cursive" fill={CHALK_CREAM} fillOpacity="0.65" pointerEvents="none">{count} drinks</text>
              </g>
            );
          })}
        </svg>
        {filterSpirit != null && (
          <div className="text-center -mt-1">
            <button
              type="button"
              onClick={() => onFilterSpirit(null)}
              className="text-sm underline underline-offset-2"
              style={{ fontFamily: FONT, color: CHALK_DIM }}
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
          {filterSpirit != null && (
            <span className="text-[15px] inline-flex items-center gap-1.5" style={{ fontFamily: FONT, color: COCKTAIL_SPIRIT_COLORS[filterSpirit] || CHALK_CREAM }}>
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: COCKTAIL_SPIRIT_COLORS[filterSpirit] || CHALK_CREAM }} aria-hidden="true" />
              {SPIRIT_SHELF.find((s) => s.key === filterSpirit)?.label}
              <button type="button" onClick={() => onFilterSpirit(null)} aria-label="Clear spirit filter" style={{ color: CHALK_SUB }}>×</button>
            </span>
          )}
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
