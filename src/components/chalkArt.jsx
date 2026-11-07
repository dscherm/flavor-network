/**
 * chalkArt.jsx — shared chalk drawings (DESIGN-1).
 *
 *   ChalkLoader   a chalk wine glass filling up; the one loading screen
 *                 every lab uses (replaces the purple spinners).
 *   CountryFlag   a tiny drawn flag (flag emoji show as "FR" on Windows).
 *   LabArt        the larger chalk drawing for each lab on the Labs menu.
 *   MakeArt       the larger chalk drawing for each Make-screen card.
 *
 * Same look as the Cocktail Lab glasses: a tinted fill under a chalk line,
 * with a faint wider stroke behind it so the line reads as chalk dust.
 */
import { useId } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { flagSpec, flagShapes, FLAG_W, FLAG_H } from '../data/countryFlags.js';

// ── chalk line helper: a faint dust halo under a crisp line ────────────
function Chalk({ d, c, w = 2.6, fill = 'none', fillOpacity = 1 }) {
  return (
    <>
      <path d={d} fill="none" stroke={c} strokeOpacity={0.25} strokeWidth={w * 2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill={fill} fillOpacity={fillOpacity} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// ── Loader ────────────────────────────────────────────────────────────
const LOADER_CSS = `
@keyframes fn-glass-fill {
  0%   { transform: translateY(40px); }
  70%  { transform: translateY(0); }
  100% { transform: translateY(0); }
}
@keyframes fn-glass-bubble {
  0%   { transform: translateY(0); opacity: 0; }
  30%  { opacity: 0.8; }
  100% { transform: translateY(-26px); opacity: 0; }
}
.fn-glass-liquid { animation: fn-glass-fill 2.2s ease-in-out infinite; }
.fn-glass-bubble { animation: fn-glass-bubble 2.2s ease-in infinite; }
@media (prefers-reduced-motion: reduce) {
  .fn-glass-liquid { animation: none; transform: translateY(14px); }
  .fn-glass-bubble { animation: none; opacity: 0; }
}`;

/** The glass on its own (no page chrome). */
export function ChalkGlass({ size = 88, color = '#e11d48' }) {
  const clip = `fn-glass-${useId().replace(/:/g, '')}`;
  const bowl = 'M30 14 Q27 52 50 60 Q73 52 70 14 Z';
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" aria-hidden="true" data-testid="chalk-glass">
      <style>{LOADER_CSS}</style>
      <defs>
        <clipPath id={clip}><path d={bowl} /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect className="fn-glass-liquid" x="20" y="22" width="60" height="44" fill={color} fillOpacity="0.7" />
        <circle className="fn-glass-bubble" cx="44" cy="56" r="1.6" fill={CHALK_CREAM} style={{ animationDelay: '0.5s' }} />
        <circle className="fn-glass-bubble" cx="55" cy="58" r="1.2" fill={CHALK_CREAM} style={{ animationDelay: '1.1s' }} />
      </g>
      <Chalk d={bowl} c={CHALK_CREAM} />
      <Chalk d="M50 60 L50 98 M34 100 Q50 95 66 100" c={CHALK_CREAM} />
    </svg>
  );
}

/**
 * Full-surface loading screen: chalkboard, glass filling up, a short
 * handwritten line. `compact` drops the full-height board so it can sit
 * inside another surface (the landing page).
 */
export function ChalkLoader({ label = 'Getting things ready…', color, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3" role="status" aria-live="polite" data-testid="chalk-loader">
        <ChalkGlass size={36} color={color} />
        <span style={{ fontFamily: FONT, fontSize: 20, color: CHALK_CREAM }}>{label}</span>
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full min-h-[60vh] pt-10"
      style={chalkSurfaceStyle()}
      role="status"
      aria-live="polite"
      data-testid="chalk-loader"
    >
      <ChalkGlass size={88} color={color} />
      <p className="mt-3" style={{ fontFamily: FONT, fontSize: 24, color: CHALK_CREAM }}>{label}</p>
    </div>
  );
}

// ── Country flag ──────────────────────────────────────────────────────
export function CountryFlag({ country, height = 12 }) {
  const clip = `fn-flag-${useId().replace(/:/g, '')}`;
  const spec = flagSpec(country);
  if (!spec) return null;
  const width = (height * FLAG_W) / FLAG_H;
  return (
    <svg
      width={width} height={height} viewBox={`0 0 ${FLAG_W} ${FLAG_H}`}
      role="img" aria-label={`${country} flag`} data-testid={`flag-${country}`}
      style={{ display: 'inline-block', verticalAlign: '-0.1em', flexShrink: 0, opacity: 0.92 }}
    >
      <defs><clipPath id={clip}><rect width={FLAG_W} height={FLAG_H} rx="2.5" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        {flagShapes(spec).map((s, i) => {
          if (s.t === 'rect') return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} />;
          if (s.t === 'circle') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />;
          return <path key={i} d={s.d} stroke={s.stroke} strokeWidth={s.sw} fill={s.fill || 'none'} />;
        })}
      </g>
      <rect x="0.6" y="0.6" width={FLAG_W - 1.2} height={FLAG_H - 1.2} rx="2.2" fill="none" stroke={CHALK_CREAM} strokeOpacity="0.45" strokeWidth="1.2" />
    </svg>
  );
}

// ── Lab drawings (viewBox 0 0 100 100) ────────────────────────────────
function Art({ size, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0, overflow: 'visible' }}>
      {children}
    </svg>
  );
}

const SHELF = 'M8 92 L92 92';

function CocktailArt({ c, size }) {
  return (
    <Art size={size}>
      {/* coupe with a cherry and a lime wheel */}
      <path d="M26 34 Q50 64 74 34 Z" fill={c} fillOpacity="0.55" />
      <Chalk d="M18 28 L82 28 Q50 72 18 28 Z" c={CHALK_CREAM} />
      <Chalk d="M50 58 L50 88 M36 90 Q50 85 64 90" c={CHALK_CREAM} />
      <Chalk d="M60 30 L70 12" c={CHALK_CREAM} w={2} />
      <circle cx="71" cy="10" r="5" fill="#dc2626" />
      <circle cx="28" cy="27" r="9" fill="#84cc16" fillOpacity="0.35" />
      <Chalk d="M19 27 A9 9 0 0 1 37 27" c="#bef264" w={2} />
      <Chalk d={SHELF} c={CHALK_SUB} w={2} />
    </Art>
  );
}
function SauceArt({ c, size }) {
  return (
    <Art size={size}>
      {/* saucepan with steam and a ladle */}
      <path d="M22 50 L78 50 L75 82 Q74 88 68 88 L32 88 Q26 88 25 82 Z" fill={c} fillOpacity="0.5" />
      <Chalk d="M18 44 L82 44 L77 84 Q76 90 69 90 L31 90 Q24 90 23 84 Z" c={CHALK_CREAM} />
      <Chalk d="M82 50 L97 46" c={CHALK_CREAM} w={3.2} />
      <Chalk d="M36 34 Q30 26 36 18 Q42 10 36 4" c={CHALK_CREAM} w={2} />
      <Chalk d="M52 36 Q46 28 52 20 Q58 12 52 6" c={CHALK_CREAM} w={2} />
      <Chalk d="M66 34 Q60 26 66 18" c={CHALK_CREAM} w={2} />
      <Chalk d="M58 56 L70 26" c={CHALK_DIM} w={2.4} />
    </Art>
  );
}
function WineArt({ c, size }) {
  return (
    <Art size={size}>
      {/* bottle + glass */}
      <path d="M14 52 L32 52 L32 88 L14 88 Z" fill={c} fillOpacity="0.35" />
      <Chalk d="M19 10 L27 10 L27 30 Q34 36 34 46 L34 88 Q34 90 32 90 L14 90 Q12 90 12 88 L12 46 Q12 36 19 30 Z" c={CHALK_CREAM} />
      <path d="M12 56 L34 56 L34 74 L12 74 Z" fill={CHALK_CREAM} fillOpacity="0.18" />
      <path d="M50 46 Q51 62 66 64 Q81 62 82 46 Z" fill={c} fillOpacity="0.75" />
      <Chalk d="M48 24 Q46 62 66 66 Q86 62 84 24 Z" c={CHALK_CREAM} />
      <Chalk d="M66 66 L66 88 M54 90 Q66 85 78 90" c={CHALK_CREAM} />
      <Chalk d={SHELF} c={CHALK_SUB} w={2} />
    </Art>
  );
}
function CookbookArt({ c, size }) {
  return (
    <Art size={size}>
      {/* open book with a ribbon and recipe lines */}
      <path d="M50 26 Q34 18 12 22 L12 80 Q34 76 50 84 Z" fill={c} fillOpacity="0.22" />
      <path d="M50 26 Q66 18 88 22 L88 80 Q66 76 50 84 Z" fill={c} fillOpacity="0.32" />
      <Chalk d="M50 26 Q34 18 12 22 L12 80 Q34 76 50 84 Q66 76 88 80 L88 22 Q66 18 50 26 Z M50 26 L50 84" c={CHALK_CREAM} />
      <Chalk d="M20 36 L42 38 M20 46 L42 48 M20 56 L36 57" c={CHALK_CREAM} w={1.8} />
      <Chalk d="M58 38 L80 36 M58 48 L80 46" c={CHALK_CREAM} w={1.8} />
      <circle cx="69" cy="62" r="7" fill="none" stroke={CHALK_CREAM} strokeWidth="1.8" />
      <path d="M70 80 L70 96 L74 92 L78 96 L78 79" fill={c} stroke={CHALK_CREAM} strokeWidth="1.5" strokeLinejoin="round" />
    </Art>
  );
}
function PairingArt({ c, size }) {
  const pts = [[20, 22, '#f472b6'], [80, 20, '#fbbf24'], [88, 62, '#a3e635'], [56, 90, '#60a5fa'], [14, 74, '#c084fc']];
  return (
    <Art size={size}>
      {pts.map(([x, y], i) => <Chalk key={`l${i}`} d={`M50 52 L${x} ${y}`} c={CHALK_CREAM} w={i % 2 ? 1.4 : 2.4} />)}
      <Chalk d="M20 22 Q50 6 80 20" c={CHALK_SUB} w={1.2} />
      {pts.map(([x, y, col], i) => (
        <g key={`n${i}`}>
          <circle cx={x} cy={y} r="8" fill={col} fillOpacity="0.85" />
          <circle cx={x} cy={y} r="8" fill="none" stroke={CHALK_CREAM} strokeWidth="1.6" />
        </g>
      ))}
      <ellipse cx="50" cy="52" rx="17" ry="12" fill="#0a0a0a" />
      <ellipse cx="50" cy="52" rx="17" ry="12" fill={c} fillOpacity="0.25" stroke={CHALK_CREAM} strokeWidth="2.6" />
    </Art>
  );
}
function NotebookArt({ c, size }) {
  return (
    <Art size={size}>
      {/* spiral notebook with a pencil */}
      <path d="M20 14 L74 14 L74 90 L20 90 Z" fill={c} fillOpacity="0.2" />
      <Chalk d="M20 14 L74 14 L74 90 L20 90 Z" c={CHALK_CREAM} />
      {[24, 36, 48, 60, 72, 84].map((y) => <Chalk key={y} d={`M14 ${y} Q20 ${y - 4} 26 ${y}`} c={CHALK_CREAM} w={1.6} />)}
      <Chalk d="M34 30 L64 30 M34 42 L64 42 M34 54 L56 54" c={CHALK_CREAM} w={1.8} />
      <path d="M58 86 L88 46 L96 52 L66 92 Z" fill="#fbbf24" fillOpacity="0.8" />
      <Chalk d="M58 86 L88 46 L96 52 L66 92 Z M58 86 L56 96 L66 92" c={CHALK_CREAM} w={2} />
    </Art>
  );
}

const LAB_ART = {
  cocktail: CocktailArt, sauce: SauceArt, wine: WineArt,
  cookbook: CookbookArt, pairing: PairingArt, recipe: NotebookArt,
};

/** Chalk drawing for a lab id (cocktail/sauce/wine/cookbook/pairing/recipe). */
export function LabArt({ id, accent = CHALK_CREAM, size = 76 }) {
  const Cmp = LAB_ART[id];
  return Cmp ? <Cmp c={accent} size={size} /> : null;
}

// ── Make-screen drawings ──────────────────────────────────────────────
function CameraArt({ c, size }) {
  return (
    <Art size={size}>
      <path d="M12 34 L32 34 L38 24 L62 24 L68 34 L88 34 L88 80 L12 80 Z" fill={c} fillOpacity="0.25" />
      <Chalk d="M12 34 L32 34 L38 24 L62 24 L68 34 L88 34 L88 80 L12 80 Z" c={CHALK_CREAM} />
      <circle cx="50" cy="56" r="15" fill="#0a0a0a" />
      <Chalk d="M35 56 A15 15 0 1 0 65 56 A15 15 0 1 0 35 56 Z" c={CHALK_CREAM} />
      <circle cx="50" cy="56" r="7" fill={c} fillOpacity="0.6" />
      <circle cx="78" cy="42" r="2.5" fill={CHALK_CREAM} />
    </Art>
  );
}
function LinkArt({ c, size }) {
  return (
    <Art size={size}>
      {/* a recipe page with a chain link */}
      <path d="M22 10 L66 10 L80 24 L80 90 L22 90 Z" fill={c} fillOpacity="0.18" />
      <Chalk d="M22 10 L66 10 L80 24 L80 90 L22 90 Z M66 10 L66 24 L80 24" c={CHALK_CREAM} />
      <Chalk d="M32 30 L58 30 M32 40 L68 40" c={CHALK_CREAM} w={1.8} />
      <Chalk d="M44 64 L58 52" c={c} w={3.4} />
      <Chalk d="M44 56 L38 62 A8 8 0 0 0 50 74 L56 68" c={c} w={3.4} />
      <Chalk d="M58 62 L64 56 A8 8 0 0 0 52 44 L46 50" c={c} w={3.4} />
    </Art>
  );
}
function PencilArt({ c, size }) {
  return (
    <Art size={size}>
      {/* blank page + pencil */}
      <path d="M16 16 L70 16 L70 90 L16 90 Z" fill={c} fillOpacity="0.15" />
      <Chalk d="M16 16 L70 16 L70 90 L16 90 Z" c={CHALK_CREAM} />
      <Chalk d="M26 32 L50 32" c={CHALK_CREAM} w={1.8} />
      <path d="M44 80 L80 30 L90 37 L54 87 Z" fill={c} fillOpacity="0.8" />
      <Chalk d="M44 80 L80 30 L90 37 L54 87 Z M44 80 L41 92 L54 87" c={CHALK_CREAM} w={2} />
    </Art>
  );
}

function PantryArt({ c, size }) {
  return (
    <Art size={size}>
      {/* KITCHEN-2: a pantry cupboard — two shelves of jars, a bottle, an onion */}
      <Chalk d="M10 8 L90 8 L90 94 L10 94 Z" c={CHALK_CREAM} />
      <Chalk d="M10 50 L90 50" c={CHALK_CREAM} w={2.2} />
      <path d="M18 24 L36 24 L36 48 L18 48 Z" fill={c} fillOpacity="0.45" />
      <Chalk d="M18 24 L36 24 L36 48 L18 48 Z M16 20 L38 20 L38 24 L16 24 Z" c={CHALK_CREAM} w={2} />
      <path d="M44 32 L60 32 L60 48 L44 48 Z" fill={c} fillOpacity="0.25" />
      <Chalk d="M44 32 L60 32 L60 48 L44 48 Z M42 28 L62 28 L62 32 L42 32 Z" c={CHALK_CREAM} w={2} />
      <Chalk d="M72 14 L78 14 L78 22 Q84 26 84 32 L84 48 L66 48 L66 32 Q66 26 72 22 Z" c={CHALK_CREAM} w={2} />
      <path d="M30 70 Q42 60 46 76 Q46 90 32 90 Q18 88 22 76 Q24 70 30 70 Z" fill={c} fillOpacity="0.35" />
      <Chalk d="M30 70 Q42 60 46 76 Q46 90 32 90 Q18 88 22 76 Q24 70 30 70 Z M33 68 Q34 62 38 60" c={CHALK_CREAM} w={2} />
      <path d="M58 66 L82 66 L82 92 L58 92 Z" fill={c} fillOpacity="0.2" />
      <Chalk d="M58 66 L82 66 L82 92 L58 92 Z M56 62 L84 62 L84 66 L56 66 Z M62 76 L78 76" c={CHALK_CREAM} w={2} />
    </Art>
  );
}
function InventArt({ c, size }) {
  return (
    <Art size={size}>
      {/* KITCHEN-2: a pan with a spark over it — a new dish */}
      <path d="M14 58 L70 58 Q68 80 42 80 Q16 80 14 58 Z" fill={c} fillOpacity="0.35" />
      <Chalk d="M14 58 L70 58 Q68 80 42 80 Q16 80 14 58 Z M70 62 L92 54" c={CHALK_CREAM} />
      <Chalk d="M42 10 L46 26 L62 30 L46 34 L42 50 L38 34 L22 30 L38 26 Z" c={c} w={2.4} fill={c} fillOpacity={0.3} />
      <Chalk d="M72 14 L74 20 L80 22 L74 24 L72 30 L70 24 L64 22 L70 20 Z" c={CHALK_CREAM} w={1.8} />
    </Art>
  );
}

const MAKE_ART = { book: CookbookArt, pencil: PencilArt, camera: CameraArt, link: LinkArt, pantry: PantryArt, invent: InventArt };

/** Chalk drawing for a Make-screen card (book/pencil/camera/link/pantry/invent). */
export function MakeArt({ kind, accent = CHALK_CREAM, size = 68 }) {
  const Cmp = MAKE_ART[kind];
  return Cmp ? <Cmp c={accent} size={size} /> : null;
}

// ── Ingredient drawings by category (DESIGN-4) ─────────────────────────
// Small drawings for the Recipe Notebook: chalk on the board (starter
// items), ink on the paper page (ingredient rows). Derived only from the
// ingredient's existing `category` field — no new data. viewBox 0 0 32 32.
const INGREDIENT_GLYPHS = {
  leaf: 'M6 26 Q6 8 26 6 Q24 24 6 26 Z M6 26 L18 14',
  drop: 'M16 4 Q26 17 23 23 A7.5 7.5 0 0 1 9 23 Q6 17 16 4 Z',
  pepper: 'M11 11 Q4 19 10 26 Q16 30 27 28 Q17 24 16 13 Q15 10 11 11 Z M13 11 Q12 6 17 4',
  citrus: 'M16 4 A12 12 0 1 0 16 28 A12 12 0 1 0 16 4 Z M16 7 L16 25 M8 12 L24 20 M8 20 L24 12',
  apple: 'M16 10 Q8 4 6 13 Q5 24 12 27 Q16 28 20 27 Q27 24 26 13 Q24 4 16 10 Z M16 10 Q16 6 19 3',
  carrot: 'M6 27 Q9 19 20 9 L23 12 Q13 23 6 27 Z M21 10 L23 3 M22 11 L29 9 M22 10 L27 5',
  bulb: 'M16 6 Q26 14 24 22 Q22 28 16 28 Q10 28 8 22 Q6 14 16 6 Z M16 6 L16 2 M16 12 Q12 20 16 28 M16 12 Q20 20 16 28',
  fish: 'M4 16 Q13 6 22 16 Q13 26 4 16 Z M22 16 L28 10 L28 22 Z M9 15 L9.5 15',
  cheese: 'M4 24 L28 24 L28 12 L4 20 Z M11 21 A1.5 1.5 0 1 0 11 21.1 M20 19 A2 2 0 1 0 20 19.1',
  wheat: 'M16 29 L16 5 M16 11 Q11 9 11 5 Q16 6 16 11 M16 11 Q21 9 21 5 Q16 6 16 11 M16 18 Q11 16 11 12 Q16 13 16 18 M16 18 Q21 16 21 12 Q16 13 16 18',
  loaf: 'M5 23 Q3 10 16 10 Q29 10 27 23 Z M11 13 L13 18 M16 12 L18 17 M21 13 L23 18',
  nut: 'M9 14 Q16 4 23 14 Z M10 14 Q10 26 16 28 Q22 26 22 14',
  cube: 'M8 12 L16 8 L24 12 L24 22 L16 26 L8 22 Z M8 12 L16 16 L24 12 M16 16 L16 26',
  bottle: 'M13 3 L19 3 L19 9 Q23 12 23 16 L23 28 L9 28 L9 16 Q9 12 13 9 Z M9 18 L23 18',
  mushroom: 'M4 16 Q4 5 16 5 Q28 5 28 16 Z M12 16 L12 27 L20 27 L20 16',
  bowl: 'M4 14 L28 14 Q27 26 16 26 Q5 26 4 14 Z M10 10 Q12 7 10 4 M17 10 Q19 7 17 4',
  tomato: 'M16 9 Q27 9 27 19 Q27 28 16 28 Q5 28 5 19 Q5 9 16 9 Z M16 9 L12 6 M16 9 L20 6 M16 9 L11 10 M16 9 L21 10 M16 9 L16 4',
  potato: 'M5 18 Q4 9 14 8 Q26 6 28 15 Q29 25 17 26 Q6 27 5 18 Z M11 14 L11.5 14.5 M19 12 L19.5 12.5 M21 20 L21.5 20.5',
  drumstick: 'M20 4 Q29 5 28 14 Q27 21 19 20 L12 25 Q13 29 9 29 Q7 29 7 27 Q4 27 4 24 Q4 21 8 21 L13 15 Q12 6 20 4 Z',
  steak: 'M6 12 Q10 4 20 6 Q29 8 27 18 Q25 27 14 26 Q4 25 5 18 Q5 15 6 12 Z M12 13 Q17 10 21 14 M10 19 Q16 21 22 18',
  egg: 'M16 4 Q25 6 25 18 Q25 28 16 28 Q7 28 7 18 Q7 6 16 4 Z',
  broccoli: 'M7 16 Q3 10 9 8 Q11 3 16 5 Q21 2 23 8 Q29 10 25 16 Z M13 16 L14 28 L18 28 L19 16 M16 22 L12 18 M16 22 L20 18',
};

const CATEGORY_GLYPH = {
  herb: 'leaf',
  liquid: 'drop', mixer: 'drop', acid: 'drop', fat: 'drop',
  chili: 'pepper', spice: 'pepper', seasoning: 'pepper',
  citrus: 'citrus',
  fruit: 'apple',
  vegetable: 'broccoli',
  aromatic: 'bulb',
  protein: 'fish',
  dairy: 'cheese',
  grain: 'wheat',
  baked: 'loaf',
  nut: 'nut',
  sweetener: 'cube', confection: 'cube',
  spirit: 'bottle', liqueur: 'bottle', bitters: 'bottle', condiment: 'bottle',
  umami: 'mushroom',
};

// A few ingredients are common enough to get their own drawing, ahead of
// their category's (tomato is a "vegetable", but not a carrot).
const NAME_GLYPH = [
  [/\b(chicken|turkey|duck|rabbit|quail|poultry)\b/, 'drumstick'],
  [/\b(beef|veal|lamb|pork|ham|sausage|bison|venison|steak|mutton|goat)\b/, 'steak'],
  [/\beggs?\b/, 'egg'],
  [/\b(tofu|paneer)\b/, 'cube'],
  [/fish|salmon|tuna|cod|shrimp|prawn|crab|lobster|clam|mussel|scallop|oyster|anchov|sardine/, 'fish'],
  [/tomato/, 'tomato'],
  [/potato/, 'potato'],
  [/onion|shallot|leek|garlic/, 'bulb'],
  [/mushroom|porcini|shiitake/, 'mushroom'],
  [/carrot|parsnip/, 'carrot'],
  [/pepper(?!mint)|chil[ei]|jalape/, 'pepper'],
  [/lemon|lime|orange|grapefruit|yuzu/, 'citrus'],
];

/**
 * Which drawing an ingredient gets: by name for a few common ones, else by
 * category ('broccoli' for other vegetables, 'bowl' when unknown).
 */
export function ingredientArtKind(category, name = '') {
  const n = String(name || '').toLowerCase();
  if (n && !/powder|paste|sauce|juice|stock|flakes/.test(n)) {
    for (const [re, kind] of NAME_GLYPH) if (re.test(n)) return kind;
  }
  return CATEGORY_GLYPH[String(category || '').toLowerCase()] || 'bowl';
}

/**
 * Small drawing of an ingredient, picked by its `category`. `ink` is the
 * line colour (chalk cream on the board, pencil brown on paper); `tint`
 * fills the shape faintly (e.g. the taste colour). Decorative: aria-hidden.
 */
export function IngredientArt({ category, name = '', size = 20, ink = CHALK_CREAM, tint = null }) {
  const kind = ingredientArtKind(category, name);
  const d = INGREDIENT_GLYPHS[kind];
  const w = size >= 40 ? 1.8 : 2.2;
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"
      data-testid="ingredient-art" data-kind={kind}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <Chalk d={d} c={ink} w={w} fill={tint || 'none'} fillOpacity={tint ? 0.35 : 1} />
    </svg>
  );
}

// ── Cookbook dish drawings (DESIGN-3) ─────────────────────────────────
// One chalk drawing per dish type (src/data/dishType.js). The food is
// tinted with the accent (the cuisine colour); lines are chalk cream.
const LEAF_GREEN = '#84cc16';
const YOLK = '#fbbf24';
const TOMATO_RED = '#ef4444';
const BOWL = 'M12 48 L88 48 Q86 82 50 86 Q14 82 12 48 Z';
const BOWL_FILL = 'M15 52 Q50 58 85 52 Q82 80 50 84 Q18 80 15 52 Z';
const BOWL_FOOT = 'M38 86 L36 92 L64 92 L62 86';
const PLATE = 'M8 70 A42 14 0 1 0 92 70 A42 14 0 1 0 8 70 Z';
const STEAM = 'M34 38 Q28 30 34 22 Q40 14 34 6 M52 38 Q46 30 52 22 Q58 14 52 6 M70 38 Q64 30 70 22';
const BASE = 'M8 92 L92 92';

/* eslint-disable react/display-name */
const DISH_DRAW = {
  soup: (c) => (
    <>
      <path d={BOWL_FILL} fill={c} fillOpacity="0.55" />
      <Chalk d={BOWL} c={CHALK_CREAM} />
      <Chalk d={BOWL_FOOT} c={CHALK_CREAM} w={2} />
      <Chalk d={STEAM} c={CHALK_CREAM} w={1.8} />
      <Chalk d="M66 52 L88 30 M86 26 Q96 22 93 31 Q90 36 85 33" c={CHALK_DIM} w={2.2} />
    </>
  ),
  noodles: (c) => (
    <>
      <path d={BOWL_FILL} fill={c} fillOpacity="0.5" />
      <Chalk d="M22 50 Q28 38 34 50 Q40 38 46 50 Q52 38 58 50 Q64 38 70 50 Q74 42 78 50" c={YOLK} w={2} />
      <Chalk d={BOWL} c={CHALK_CREAM} />
      <Chalk d={BOWL_FOOT} c={CHALK_CREAM} w={2} />
      <Chalk d="M52 44 L86 8 M60 46 L94 14" c={CHALK_DIM} w={2.4} />
    </>
  ),
  pasta: (c) => (
    <>
      <path d={PLATE} fill={CHALK_CREAM} fillOpacity="0.08" />
      <Chalk d={PLATE} c={CHALK_CREAM} w={2.2} />
      <path d="M24 64 A26 12 0 1 0 76 64 A26 12 0 1 0 24 64 Z" fill={c} fillOpacity="0.55" />
      <Chalk d="M28 64 Q50 46 72 64 Q50 76 34 62 Q50 52 64 64 Q52 70 44 64" c={YOLK} w={2} />
      <Chalk d="M56 60 L72 18 M66 16 L68 6 M71 18 L74 8 M76 20 L80 10 M66 16 Q71 24 76 20" c={CHALK_CREAM} w={2} />
    </>
  ),
  rice: (c) => (
    <>
      <path d={BOWL_FILL} fill={c} fillOpacity="0.55" />
      <path d="M18 48 Q50 14 82 48 Z" fill={CHALK_CREAM} fillOpacity="0.22" />
      <Chalk d="M18 48 Q50 14 82 48" c={CHALK_CREAM} w={2.2} />
      {[[36, 38], [48, 30], [60, 37], [42, 44], [56, 44], [50, 38]].map(([x, y]) => (
        <Chalk key={`${x}-${y}`} d={`M${x - 2} ${y} L${x + 2} ${y - 1}`} c={CHALK_CREAM} w={1.6} />
      ))}
      <Chalk d={BOWL} c={CHALK_CREAM} />
      <Chalk d={BOWL_FOOT} c={CHALK_CREAM} w={2} />
    </>
  ),
  curry: (c) => (
    <>
      <path d="M21 46 L79 46 L76 82 Q75 86 70 86 L30 86 Q25 86 24 82 Z" fill={c} fillOpacity="0.55" />
      <Chalk d="M18 40 L82 40 L78 84 Q77 90 70 90 L30 90 Q23 90 22 84 Z" c={CHALK_CREAM} />
      <Chalk d="M20 48 Q8 48 9 56 Q10 62 21 60 M80 48 Q92 48 91 56 Q90 62 79 60" c={CHALK_CREAM} w={2.2} />
      <Chalk d="M30 47 Q50 42 70 47" c={YOLK} w={1.8} />
      {[[36, 56], [50, 60], [62, 54]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill={CHALK_CREAM} fillOpacity="0.55" />)}
      <Chalk d={STEAM} c={CHALK_CREAM} w={1.8} />
    </>
  ),
  stew: (c) => (
    <>
      <path d="M19 54 L81 54 L79 84 Q78 88 72 88 L28 88 Q22 88 21 84 Z" fill={c} fillOpacity="0.55" />
      <Chalk d="M16 50 L84 50 L82 84 Q80 92 72 92 L28 92 Q20 92 18 84 Z" c={CHALK_CREAM} />
      <path d="M12 46 Q50 18 88 46 Z" fill={c} fillOpacity="0.3" />
      <Chalk d="M12 46 Q50 18 88 46 Z" c={CHALK_CREAM} />
      <Chalk d="M44 30 L44 22 L56 22 L56 30" c={CHALK_CREAM} w={2.2} />
      <Chalk d="M16 58 L8 58 L8 66 L17 66 M84 58 L92 58 L92 66 L83 66" c={CHALK_CREAM} w={2} />
    </>
  ),
  grill: (c) => (
    <>
      <Chalk d="M8 92 L92 92 M14 84 L86 84" c={CHALK_SUB} w={2} />
      <Chalk d="M10 82 L90 14" c={CHALK_DIM} w={2.4} />
      {[[30, 65, c], [46, 51, LEAF_GREEN], [62, 38, c], [76, 26, TOMATO_RED]].map(([x, y, col]) => {
        const d = `M${x - 9} ${y - 7} L${x + 7} ${y - 9} L${x + 9} ${y + 7} L${x - 7} ${y + 9} Z`;
        return (
          <g key={`${x}`}>
            <path d={d} fill={col} fillOpacity="0.6" />
            <Chalk d={d} c={CHALK_CREAM} w={2} />
          </g>
        );
      })}
    </>
  ),
  fish: (c) => (
    <>
      <Chalk d={PLATE} c={CHALK_CREAM} w={2.2} />
      <path d="M18 60 Q42 34 68 60 Q42 84 18 60 Z" fill={c} fillOpacity="0.55" />
      <Chalk d="M18 60 Q42 34 68 60 Q42 84 18 60 Z M68 60 L86 46 L84 74 Z" c={CHALK_CREAM} />
      <Chalk d="M34 50 Q40 60 34 70" c={CHALK_CREAM} w={1.8} />
      <circle cx="26" cy="57" r="2.4" fill={CHALK_CREAM} />
      <path d="M76 76 Q84 70 90 76 Q84 82 76 78 Z" fill={YOLK} fillOpacity="0.8" />
    </>
  ),
  salad: (c) => (
    <>
      <path d={BOWL_FILL} fill={c} fillOpacity="0.5" />
      {['M24 50 Q16 30 34 24 Q38 40 24 50 Z', 'M44 48 Q40 22 58 16 Q62 36 44 48 Z', 'M62 50 Q66 28 82 30 Q78 46 62 50 Z'].map((d) => (
        <g key={d}>
          <path d={d} fill={LEAF_GREEN} fillOpacity="0.55" />
          <Chalk d={d} c={CHALK_CREAM} w={1.8} />
        </g>
      ))}
      <circle cx="40" cy="44" r="6" fill={TOMATO_RED} fillOpacity="0.8" />
      <Chalk d={BOWL} c={CHALK_CREAM} />
      <Chalk d={BOWL_FOOT} c={CHALK_CREAM} w={2} />
    </>
  ),
  wok: (c) => (
    <>
      <path d="M12 52 Q50 90 88 52 Z" fill={c} fillOpacity="0.5" />
      <Chalk d="M8 48 L92 48 Q50 98 8 48 Z" c={CHALK_CREAM} />
      <Chalk d="M90 50 L99 44" c={CHALK_CREAM} w={3.2} />
      <Chalk d="M26 38 Q34 16 50 14 Q66 16 74 34" c={CHALK_SUB} w={1.4} />
      {[[30, 32, LEAF_GREEN], [48, 22, TOMATO_RED], [66, 28, YOLK], [42, 42, c]].map(([x, y, col]) => (
        <path key={`${x}`} d={`M${x - 5} ${y - 3} L${x + 5} ${y - 4} L${x + 4} ${y + 4} L${x - 4} ${y + 4} Z`} fill={col} fillOpacity="0.8" stroke={CHALK_CREAM} strokeWidth="1" />
      ))}
    </>
  ),
  taco: (c) => (
    <>
      <path d="M14 76 A36 36 0 0 1 86 76 Z" fill={YOLK} fillOpacity="0.3" />
      <Chalk d="M20 60 Q26 46 32 56 Q38 42 46 52 Q52 38 60 50 Q66 40 72 54 Q78 46 82 62" c={LEAF_GREEN} w={2.6} />
      <path d="M24 64 Q50 44 76 64 Q50 70 24 64 Z" fill={c} fillOpacity="0.65" />
      <Chalk d="M14 76 A36 36 0 0 1 86 76 Z" c={CHALK_CREAM} />
      <Chalk d="M8 88 L92 88" c={CHALK_SUB} w={2} />
    </>
  ),
  sandwich: (c) => (
    <>
      <path d="M16 44 Q16 16 50 16 Q84 16 84 44 Z" fill={YOLK} fillOpacity="0.3" />
      <Chalk d="M16 44 Q16 16 50 16 Q84 16 84 44 Z" c={CHALK_CREAM} />
      {[[36, 28], [50, 24], [64, 28], [44, 36], [58, 36]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2" ry="1.2" fill={CHALK_CREAM} />)}
      <Chalk d="M12 49 Q18 43 24 49 Q30 55 36 49 Q42 43 48 49 Q54 55 60 49 Q66 43 72 49 Q78 55 88 49" c={LEAF_GREEN} w={2.4} />
      <path d="M14 54 L86 54 Q88 61 86 66 L14 66 Q12 61 14 54 Z" fill={c} fillOpacity="0.7" />
      <Chalk d="M14 54 L86 54 Q88 61 86 66 L14 66 Q12 61 14 54 Z" c={CHALK_CREAM} w={2} />
      <path d="M22 54 L78 54 L72 61 L64 56 L56 62 L46 56 L36 61 Z" fill={YOLK} fillOpacity="0.85" />
      <path d="M16 70 L84 70 Q84 82 76 82 L24 82 Q16 82 16 70 Z" fill={YOLK} fillOpacity="0.3" />
      <Chalk d="M16 70 L84 70 Q84 82 76 82 L24 82 Q16 82 16 70 Z" c={CHALK_CREAM} />
      <Chalk d={BASE} c={CHALK_SUB} w={2} />
    </>
  ),
  wrap: (c) => (
    <>
      <path d="M18 36 Q24 14 40 20 Q50 8 62 20 Q78 14 82 36 Q50 26 18 36 Z" fill={c} fillOpacity="0.7" />
      <Chalk d="M26 26 Q30 18 34 24 M56 16 Q60 10 64 18 M70 24 Q74 18 78 26" c={LEAF_GREEN} w={2.2} />
      <path d="M50 92 L16 34 Q50 24 84 34 Z" fill={YOLK} fillOpacity="0.3" />
      <Chalk d="M50 92 L16 34 Q50 24 84 34 Z" c={CHALK_CREAM} />
      <path d="M33 63 Q50 58 67 63 L50 92 Z" fill={CHALK_CREAM} fillOpacity="0.25" />
      <Chalk d="M33 63 Q50 58 67 63" c={CHALK_CREAM} w={1.8} />
      <Chalk d="M30 46 Q50 40 70 46" c={CHALK_CREAM} w={1.4} />
    </>
  ),
  dumpling: (c) => (
    <>
      <path d="M14 70 Q50 22 86 70 Q50 84 14 70 Z" fill={c} fillOpacity="0.4" />
      <Chalk d="M14 70 Q50 22 86 70 Q50 84 14 70 Z" c={CHALK_CREAM} />
      <Chalk d="M30 52 L36 60 M42 44 L45 54 M56 44 L54 54 M68 52 L63 60" c={CHALK_CREAM} w={1.8} />
      <Chalk d="M8 88 L92 88" c={CHALK_SUB} w={2} />
      <Chalk d="M36 26 Q32 20 36 14 M50 22 Q46 16 50 10 M64 26 Q60 20 64 14" c={CHALK_CREAM} w={1.6} />
    </>
  ),
  dip: (c) => (
    <>
      <path d="M14 56 Q50 46 86 56 Q80 86 50 88 Q20 86 14 56 Z" fill={c} fillOpacity="0.55" />
      <Chalk d="M10 56 L90 56 Q84 90 50 92 Q16 90 10 56 Z" c={CHALK_CREAM} />
      <Chalk d="M30 52 Q50 42 70 52 Q50 60 40 52" c={CHALK_CREAM} w={1.8} />
      <circle cx="50" cy="50" r="2" fill={YOLK} />
      <path d="M62 48 L80 14 L94 32 Z" fill={YOLK} fillOpacity="0.35" />
      <Chalk d="M62 48 L80 14 L94 32 Z" c={CHALK_CREAM} w={2} />
    </>
  ),
  // Patatas bravas and other small plates: a clay dish of potato cubes
  // under red sauce and a line of aioli.
  tapas: (c) => (
    <>
      <path d="M12 54 A38 18 0 1 0 88 54 A38 18 0 1 0 12 54 Z" fill={c} fillOpacity="0.45" />
      <Chalk d="M12 54 A38 18 0 1 0 88 54 A38 18 0 1 0 12 54 Z" c={CHALK_CREAM} />
      <Chalk d="M14 60 Q50 84 86 60" c={CHALK_CREAM} w={2} />
      {[[30, 50], [42, 44], [55, 47], [67, 51], [37, 58], [50, 57], [62, 60]].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <rect x={x - 6} y={y - 6} width="12" height="11" rx="3" fill={YOLK} fillOpacity="0.85" />
          <rect x={x - 6} y={y - 6} width="12" height="11" rx="3" fill="none" stroke={CHALK_CREAM} strokeWidth="1.2" />
        </g>
      ))}
      <Chalk d="M26 46 Q34 54 42 44 Q50 36 58 46 Q66 56 74 48" c={TOMATO_RED} w={3.2} />
      <Chalk d="M30 56 Q40 50 48 56 Q58 62 68 54" c={CHALK_CREAM} w={2.2} />
      <Chalk d={BASE} c={CHALK_SUB} w={2} />
    </>
  ),
  // Bánh mì and other baguette sandwiches: a long roll, split, with filling.
  baguette: (c) => (
    <>
      <path d="M10 62 Q8 44 30 38 L80 26 Q96 24 92 40 Q90 50 74 54 L26 68 Q12 72 10 62 Z" fill={YOLK} fillOpacity="0.3" />
      <path d="M18 58 L84 38 L86 44 L20 64 Z" fill={c} fillOpacity="0.75" />
      <Chalk d="M18 58 Q40 50 60 46 Q72 42 84 38" c={LEAF_GREEN} w={2.6} />
      <Chalk d="M20 63 Q44 56 86 44" c={TOMATO_RED} w={2} />
      <Chalk d="M10 62 Q8 44 30 38 L80 26 Q96 24 92 40 Q90 50 74 54 L26 68 Q12 72 10 62 Z" c={CHALK_CREAM} />
      <Chalk d="M34 40 L40 34 M50 36 L56 30 M66 32 L72 26" c={CHALK_CREAM} w={2} />
      <Chalk d={BASE} c={CHALK_SUB} w={2} />
    </>
  ),
  skillet: (c) => (
    <>
      <path d="M14 56 A32 20 0 1 0 78 56 A32 20 0 1 0 14 56 Z" fill={c} fillOpacity="0.5" />
      <Chalk d="M10 56 A36 24 0 1 0 82 56 A36 24 0 1 0 10 56 Z" c={CHALK_CREAM} />
      <Chalk d="M82 52 L99 44" c={CHALK_CREAM} w={3.4} />
      {[[34, 52], [56, 62]].map(([x, y]) => (
        <g key={x}>
          <path d={`M${x - 11} ${y} Q${x - 8} ${y - 10} ${x + 2} ${y - 9} Q${x + 12} ${y - 4} ${x + 9} ${y + 5} Q${x} ${y + 11} ${x - 11} ${y} Z`} fill={CHALK_CREAM} fillOpacity="0.7" />
          <circle cx={x} cy={y} r="4.5" fill={YOLK} />
        </g>
      ))}
    </>
  ),
  pizza: (c) => (
    <>
      <path d="M18 54 A32 32 0 1 0 82 54 A32 32 0 1 0 18 54 Z" fill={c} fillOpacity="0.55" />
      <Chalk d="M12 54 A38 38 0 1 0 88 54 A38 38 0 1 0 12 54 Z" c={CHALK_CREAM} />
      <Chalk d="M50 18 L50 90 M18 36 L82 72 M18 72 L82 36" c={CHALK_CREAM} w={1.4} />
      {[[38, 40], [64, 46], [42, 70], [66, 68]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill={CHALK_CREAM} fillOpacity="0.7" />)}
      {[[56, 32], [30, 56], [58, 60]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x - 4} ${y} Q${x} ${y - 6} ${x + 4} ${y} Q${x} ${y + 4} ${x - 4} ${y} Z`} fill={LEAF_GREEN} />)}
    </>
  ),
  bake: (c) => (
    <>
      <path d="M14 80 Q12 42 50 40 Q88 42 86 80 Z" fill={c} fillOpacity="0.45" />
      <Chalk d="M14 80 Q12 42 50 40 Q88 42 86 80 Z" c={CHALK_CREAM} />
      <Chalk d="M30 54 L38 66 M46 50 L54 64 M62 50 L70 64" c={CHALK_CREAM} w={2} />
      <Chalk d="M6 88 L94 88" c={CHALK_SUB} w={2.4} />
      <Chalk d="M36 32 Q32 24 36 16 M54 30 Q50 22 54 14" c={CHALK_CREAM} w={1.6} />
    </>
  ),
  dessert: (c) => (
    <>
      <path d="M14 56 L84 40 L84 78 L14 90 Z" fill={c} fillOpacity="0.5" />
      <Chalk d="M14 56 L84 40 L84 78 L14 90 Z" c={CHALK_CREAM} />
      <Chalk d="M14 73 L84 59" c={CHALK_CREAM} w={1.8} />
      <Chalk d="M14 56 Q24 50 30 54 Q38 46 46 50 Q54 42 62 46 Q70 38 84 40" c={CHALK_CREAM} w={2.2} />
      <circle cx="70" cy="34" r="6" fill={TOMATO_RED} />
      <Chalk d="M70 28 Q72 18 80 14" c={LEAF_GREEN} w={1.6} />
      <Chalk d={BASE} c={CHALK_SUB} w={2} />
    </>
  ),
  veg: (c) => (
    <>
      {/* a long roasting pepper (poblano) beside an ear of corn */}
      <g transform="rotate(-45 68 38)">
        <ellipse cx="68" cy="38" rx="10" ry="25" fill={YOLK} fillOpacity="0.55" stroke={CHALK_CREAM} strokeWidth="2.2" />
        <path d="M63 22 L63 54 M68 16 L68 60 M73 22 L73 54 M60 30 L76 30 M59 38 L77 38 M60 46 L76 46" stroke={CHALK_CREAM} strokeOpacity="0.55" strokeWidth="1.2" />
        <path d="M58 58 Q56 70 66 76 Q66 66 68 62 M78 58 Q80 70 70 76" fill="none" stroke={LEAF_GREEN} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <path d="M22 26 Q12 36 20 54 Q32 76 60 88 Q74 92 82 86 Q62 74 52 58 Q42 40 36 28 Q30 20 22 26 Z" fill={c} fillOpacity="0.6" />
      <Chalk d="M22 26 Q12 36 20 54 Q32 76 60 88 Q74 92 82 86 Q62 74 52 58 Q42 40 36 28 Q30 20 22 26 Z" c={CHALK_CREAM} />
      <Chalk d="M26 34 Q30 52 46 68" c={CHALK_CREAM} w={1.4} />
      <Chalk d="M20 26 Q22 18 28 22 Q30 16 36 26 M27 22 Q26 12 34 6" c={LEAF_GREEN} w={2.6} />
    </>
  ),
  plate: (c) => (
    <>
      <path d="M18 72 Q18 32 50 32 Q82 32 82 72 Z" fill={c} fillOpacity="0.4" />
      <Chalk d="M18 72 Q18 32 50 32 Q82 32 82 72 Z" c={CHALK_CREAM} />
      <Chalk d="M44 32 L44 24 L56 24 L56 32" c={CHALK_CREAM} w={2.2} />
      <Chalk d="M8 74 L92 74 Q90 82 50 82 Q10 82 8 74 Z" c={CHALK_CREAM} w={2.2} />
    </>
  ),
};
/* eslint-enable react/display-name */

/** Kinds DishArt can draw (the keys of DISH_TYPES in src/data/dishType.js). */
export const DISH_ART_KINDS = Object.keys(DISH_DRAW);

/** Chalk drawing of a dish type, the food tinted with `accent`. Decorative. */
export function DishArt({ kind, accent = CHALK_CREAM, size = 64 }) {
  const known = Object.prototype.hasOwnProperty.call(DISH_DRAW, kind);
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"
      data-testid="dish-art" data-kind={known ? kind : 'plate'}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      {(known ? DISH_DRAW[kind] : DISH_DRAW.plate)(accent)}
    </svg>
  );
}

// ── Ingredient glyphs (DESIGN-3) ──────────────────────────────────────
// A tiny chalk sketch per ingredient-graph category, for ingredient chips.
const GLYPH_OF_CATEGORY = {
  protein: 'meat',
  vegetable: 'veg', umami: 'veg',
  fruit: 'fruit', citrus: 'fruit',
  herb: 'leaf', aromatic: 'leaf',
  spice: 'spice', seasoning: 'spice', chili: 'chili',
  dairy: 'cheese',
  grain: 'grain', baked: 'grain', thickener: 'grain',
  fat: 'drop', liquid: 'drop',
  condiment: 'jar', acid: 'jar', mixer: 'jar',
  sweetener: 'sugar', confection: 'sugar',
  nut: 'nut',
  spirit: 'bottle', liqueur: 'bottle', bitters: 'bottle',
};

/** Glyph kind for an ingredient category, or null when there is none. */
export function ingredientGlyphKind(category) {
  return GLYPH_OF_CATEGORY[String(category || '').toLowerCase()] || null;
}

const GLYPH_PATH = {
  meat: 'M8 9.5 Q6 3.5 11 2 Q16.5 1 16 6.5 Q15.5 10.5 9.5 10.5 Z M9 10 L4.5 14.5 M4.5 14.5 Q2 13.5 2.4 15.6 M4.5 14.5 Q5.5 17 3.4 16.8',
  veg: 'M5 7 L10 16 L12 14 L8 5 Z M8 5 L6 2 M8 5 L9.4 1.6 M8 5 L11 3',
  fruit: 'M9 5 Q3 4 3 10 Q4 16 9 15 Q14 16 15 10 Q15 4 9 5 Z M9 5 Q9 2 11 1.5',
  leaf: 'M9 2 C4 4 4 12 9 16 C14 12 14 4 9 2 Z M9 4 L9 15',
  spice: 'M9 2 L9 16 M2 9 L16 9 M4 4 L14 14 M14 4 L4 14',
  chili: 'M6 4 C6 2 9 2 9 4 M9 4 C13 5 14 10 10 14 C7 16 4 14 5 11 C6 8 7 6 9 4 Z',
  cheese: 'M2 13 L16 13 L16 7 L2 10 Z M16 7 L8 4 L2 10',
  grain: 'M9 16 L9 3 M9 6 Q6 5 5 3 M9 6 Q12 5 13 3 M9 10 Q6 9 5 7 M9 10 Q12 9 13 7 M9 13 Q6 12 5 10 M9 13 Q12 12 13 10',
  drop: 'M9 2 Q4 9 4 11.5 Q4 16 9 16 Q14 16 14 11.5 Q14 9 9 2 Z',
  jar: 'M5 5 L13 5 L13 15 Q13 16 12 16 L6 16 Q5 16 5 15 Z M6 2 L12 2 L12 5 L6 5 Z M5 9 L13 9',
  sugar: 'M3 7 L9 4 L15 7 L15 13 L9 16 L3 13 Z M3 7 L9 10 L15 7 M9 10 L9 16',
  nut: 'M9 3 Q15 4 15 10 Q14 16 9 16 Q4 16 3 10 Q3 4 9 3 Z M9 3 Q7 9 9 16',
  bottle: 'M7.5 1.5 L10.5 1.5 L10.5 5 Q13 6.5 13 9 L13 16 L5 16 L5 9 Q5 6.5 7.5 5 Z',
};

/** Small chalk glyph for an ingredient category (renders nothing when unknown). */
export function IngredientGlyph({ category, color = CHALK_DIM, size = 16 }) {
  const kind = ingredientGlyphKind(category);
  if (!kind) return null;
  const d = GLYPH_PATH[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" data-testid="ingredient-glyph" data-kind={kind} style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
