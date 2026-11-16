/**
 * FlavorWheel — CHART-3, design C. Seventeen fixed wedges as inline SVG from flavorWheel(): a faint track for every
 * axis, a coloured wedge for each note that is on, labels outside the rim for the strongest few (staggered so
 * neighbours near the top and bottom do not collide), and a one-line key saying which part is taste.
 * Colours: a bar's own, else axisColor() for an absent axis (drawn only as a track, so it never shows).
 *
 * Props   bars   testidPrefix default 'profile'
 * Test ids  {p}-wheel (the svg), {p}-wedge-{axis} (on wedges only), {p}-wheel-key
 */
import { flavorWheel } from '../data/flavorCharts.js';
import { AXES } from '../data/flavorDisplay.js';
import { axisColor } from '../data/recipeProfileAnalysis.js';
import { SANS, CHALK_CREAM, CHALK_SUB } from './inventUi.jsx';

const R = 76, R0 = 15, PAD_X = 50, PAD_Y = 30, FS = 11;
const W = 2 * (R + PAD_X), H = 2 * (R + PAD_Y), CX = W / 2, CY = H / 2;
const f = (n) => Number(n).toFixed(1);
const COLORS = Object.fromEntries(AXES.map((a) => [a, axisColor(a)]));

function sector(r0, r1, a0, a1) {
  const pt = (rad, a) => { const t = (a * Math.PI) / 180; return `${f(CX + Math.cos(t) * rad)} ${f(CY + Math.sin(t) * rad)}`; };
  return `M${pt(r1, a0)}A${r1} ${r1} 0 0 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0} ${r0} 0 0 0 ${pt(r0, a0)}Z`;
}

export default function FlavorWheel({ bars, testidPrefix = 'profile' }) {
  const p = testidPrefix;
  const wheel = flavorWheel(bars, 'card', { colors: COLORS });
  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block mx-auto w-full" style={{ maxWidth: 320 }} role="img" aria-label="Flavor wheel" data-testid={`${p}-wheel`}>
        {wheel.wedges.map((w) => <path key={`t-${w.axis}`} d={sector(R0, R, w.start, w.end)} fill="rgba(255,255,255,0.08)" />)}
        {wheel.wedges.filter((w) => w.on).map((w) => (
          <path key={w.axis} data-testid={`${p}-wedge-${w.axis}`} d={sector(R0, R0 + (R - R0) * w.drawn, w.start, w.end)} fill={w.color || CHALK_SUB} />
        ))}
        {wheel.wedges.filter((w) => w.labelled).map((w) => {
          const mid = (w.mid * Math.PI) / 180, c = Math.cos(mid), sn = Math.sin(mid);
          const rr = R + 7 + (Math.abs(c) < 0.5 && w.index % 2 ? 11 : 0);
          const x = CX + c * rr;
          const y = CY + sn * rr + (sn > 0.3 ? FS * 0.8 : sn < -0.3 ? -2 : FS * 0.35);
          return (
            <text key={`l-${w.axis}`} x={f(x)} y={f(y)} fontSize={FS} textAnchor={c > 0.25 ? 'start' : c < -0.25 ? 'end' : 'middle'} fill={CHALK_CREAM} style={{ fontFamily: SANS }}>{w.label}</text>
          );
        })}
      </svg>
      <p className="mt-1 mb-0 text-center text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-wheel-key`}>Upper left: tastes. The rest: aromas.</p>
    </div>
  );
}
