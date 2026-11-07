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

const MAKE_ART = { book: CookbookArt, pencil: PencilArt, camera: CameraArt, link: LinkArt };

/** Chalk drawing for a Make-screen card (book/pencil/camera/link). */
export function MakeArt({ kind, accent = CHALK_CREAM, size = 68 }) {
  const Cmp = MAKE_ART[kind];
  return Cmp ? <Cmp c={accent} size={size} /> : null;
}
