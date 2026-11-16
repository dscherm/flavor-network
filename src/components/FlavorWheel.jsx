/**
 * FlavorWheel — CHART-3, design C. Seventeen fixed wedges as inline SVG from flavorWheel(): a faint track for every
 * axis, a coloured wedge for each note that is on, labels outside the rim for the strongest few (staggered so
 * neighbours near the top and bottom do not collide), and a one-line key saying which part is taste.
 * Colours: a bar's own, else axisColor() for an absent axis (drawn only as a track, so it never shows).
 *
 * Props   bars   testidPrefix default 'profile'   marks (optional, from ingredientMarks: one dot per ingredient, labelled
 *         where the text clears its neighbours; every mark is also in the {p}-marks-list for screen readers)
 * Test ids  {p}-wheel (the svg), {p}-wedge-{axis} (on wedges only), {p}-wheel-key, {p}-mark-{n} (dot), {p}-mark-label-{n}, {p}-marks-list
 */
import { flavorWheel } from '../data/flavorCharts.js';
import { AXES } from '../data/flavorDisplay.js';
import { axisColor } from '../data/recipeProfileAnalysis.js';
import { markLabel, thinLabels } from '../data/flavorMarks.js';
import { SANS, CHALK_CREAM, CHALK_SUB } from './inventUi.jsx';

const R = 76, R0 = 15, PAD_X = 50, PAD_Y = 30, FS = 11;
const W = 2 * (R + PAD_X), H = 2 * (R + PAD_Y), CX = W / 2, CY = H / 2;
const f = (n) => Number(n).toFixed(1);
const COLORS = Object.fromEntries(AXES.map((a) => [a, axisColor(a)]));

function sector(r0, r1, a0, a1) {
  const pt = (rad, a) => { const t = (a * Math.PI) / 180; return `${f(CX + Math.cos(t) * rad)} ${f(CY + Math.sin(t) * rad)}`; };
  return `M${pt(r1, a0)}A${r1} ${r1} 0 0 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0} ${r0} 0 0 0 ${pt(r0, a0)}Z`;
}

export default function FlavorWheel({ bars, testidPrefix = 'profile', marks = null }) {
  const p = testidPrefix;
  const wheel = flavorWheel(bars, 'card', { colors: COLORS });
  const placed = (marks || []).map((m, i) => {
    const rad = (m.angle * Math.PI) / 180, rr = R0 + (R - R0) * m.t;
    return { ...m, i, x: Math.cos(rad) * rr, y: Math.sin(rad) * rr };
  });
  const labelled = thinLabels(placed, { fontSize: FS - 1 });
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
        {placed.map((m) => (
          <g key={`m-${m.i}`}>
            <circle data-testid={`${p}-mark-${m.i}`} cx={f(CX + m.x)} cy={f(CY + m.y)} r={3} fill={COLORS[m.dominant] || CHALK_SUB} stroke={CHALK_CREAM} strokeWidth={1} />
            {labelled.has(m.name) && (
              <text
                data-testid={`${p}-mark-label-${m.i}`}
                x={f(CX + m.x + (m.x >= 0 ? 5 : -5))} y={f(CY + m.y + 3)} fontSize={FS - 1}
                textAnchor={m.x >= 0 ? 'start' : 'end'} fill={CHALK_CREAM} stroke="rgba(20,24,22,0.85)" strokeWidth={2.5} paintOrder="stroke"
                style={{ fontFamily: SANS }}
              >{markLabel(m.name)}</text>
            )}
          </g>
        ))}
      </svg>
      {placed.length > 0 && (
        <ul className="mt-1 mb-0 pl-0 list-none text-center text-[12px] leading-snug" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-marks-list`}>
          {placed.map((m) => <li key={`li-${m.i}`} className="inline">{m.i > 0 ? ' · ' : ''}<span style={{ color: CHALK_CREAM }}>{m.name}</span> ({m.notes.join(', ').toLowerCase()})</li>)}
        </ul>
      )}
      <p className="mt-1 mb-0 text-center text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-wheel-key`}>Left side: tastes. The rest: aromas.</p>
    </div>
  );
}
