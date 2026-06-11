/**
 * ProfileDeltaRadar — small SVG radar over the 11 flavor axes showing the
 * recipe's profile BEFORE (faint fill) and AFTER adding/swapping a candidate
 * (accent outline). Used on the suggestion cards to visualize how an
 * ingredient augments the recipe's flavor profile.
 */
import { AXES, axisLabel, axisColor } from '../data/recipeProfileAnalysis.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function polygon(values, cx, cy, R) {
  const pts = AXES.map((a, i) => {
    const ang = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    const r = clamp01(values[a] || 0) * R;
    return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
  });
  return pts.join(' ');
}

export default function ProfileDeltaRadar({ before, delta, size = 132, movers = [] }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 14;
  const after = {};
  for (const a of AXES) after[a] = clamp01((before[a] || 0) + (delta?.[a] || 0));

  const moverSet = new Set(movers.map((m) => m.axis));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Flavor profile change">
      {/* axis spokes + grid ring */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#c9b99a" strokeWidth="0.75" opacity="0.5" />
      {AXES.map((a, i) => {
        const ang = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
        const x = cx + R * Math.cos(ang);
        const y = cy + R * Math.sin(ang);
        return <line key={a} x1={cx} y1={cy} x2={x} y2={y} stroke="#e8dcc0" strokeWidth="0.5" />;
      })}
      {/* before (faint fill) */}
      <polygon points={polygon(before, cx, cy, R)} fill="#a09070" fillOpacity="0.18" stroke="#a09070" strokeWidth="1" />
      {/* after (accent outline) */}
      <polygon points={polygon(after, cx, cy, R)} fill="none" stroke="#3a8a5a" strokeWidth="1.75" />
      {/* dots on the axes that moved most */}
      {AXES.map((a, i) => {
        if (!moverSet.has(a)) return null;
        const ang = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
        const r = after[a] * R;
        return (
          <circle key={`m-${a}`} cx={cx + r * Math.cos(ang)} cy={cy + r * Math.sin(ang)} r="2.5" fill={axisColor(a)} />
        );
      })}
    </svg>
  );
}

/** Inline "sweet ▲ green ▼" delta summary from topMovers output. */
export function DeltaSummary({ movers = [] }) {
  if (!movers.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {movers.map((m) => (
        <span key={m.axis} className="text-xs inline-flex items-center gap-0.5" style={{ color: axisColor(m.axis) }}>
          {axisLabel(m.axis).toLowerCase()} {m.delta >= 0 ? '▲' : '▼'}
        </span>
      ))}
    </div>
  );
}
