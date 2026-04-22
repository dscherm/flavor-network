/**
 * ProfileRadar — single generic radar chart rendered from a values map.
 *
 * Inputs:
 *   axes:   string[] — axis labels (displayed in upper case, stripped of odor_)
 *   values: {[axis]: number in [0..1]}
 *   label:  string (caption below the chart)
 *   color:  stroke/fill color for the polygon
 *   size:   px (default 180)
 *
 * Used by the ProfileRadarCarousel to show taste-only / aroma-only /
 * combined views of a single ingredient's GNN prediction.
 */

function displayLabel(axis) {
  return (axis.startsWith('odor_') ? axis.slice(5) : axis).toUpperCase();
}

export default function ProfileRadar({ axes, values, label, color = '#22d3ee', size = 180 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelOffset = size * 0.08;

  if (!axes || axes.length === 0) return null;

  const polygonPoints = axes.map((ax, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const v = Math.max(0, Math.min(1, values?.[ax] ?? 0));
    const r = v * radius;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPoints = (level) => axes.map((_, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = level * radius;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');

  const axisData = axes.map((ax, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return {
      ax,
      x1: cx, y1: cy,
      x2: cx + radius * Math.cos(angle),
      y2: cy + radius * Math.sin(angle),
      lx: cx + (radius + labelOffset) * Math.cos(angle),
      ly: cy + (radius + labelOffset) * Math.sin(angle),
    };
  });

  const fontSize = axes.length > 8 ? 7 : 9;

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: size + 40 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="select-none"
        role="img"
        aria-label={`${label} radar`}
      >
        <rect x="0" y="0" width={size} height={size} rx="8" fill="rgba(17,17,27,0.6)" />
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={gridPoints(level)}
            fill="none"
            stroke="rgba(55,65,81,0.6)"
            strokeWidth={level === 1.0 ? 1 : 0.5}
          />
        ))}
        {axisData.map(({ ax, x1, y1, x2, y2 }) => (
          <line key={ax} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(55,65,81,0.6)" strokeWidth={0.5} />
        ))}
        <polygon points={polygonPoints} fill={`${color}4D`} stroke={color} strokeWidth={1.5} />
        {axisData.map(({ ax, lx, ly }) => (
          <text
            key={`l-${ax}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fill="#9ca3af"
            className="select-none"
          >{displayLabel(ax)}</text>
        ))}
      </svg>
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  );
}
