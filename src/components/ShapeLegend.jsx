/**
 * ShapeLegend — always-expanded vertical rail anchored to the LEFT
 * edge of the viewport, listing each shape silhouette with its
 * category. Used by:
 *
 *   - Cocktail Lab (subcluster category → shape)
 *   - Sauce Lab    (cuisine → shape)
 *   - LivingArchView α-mode (focal + affinity tier → shape)
 *
 * Design rationale (per user request 2026-04-29): the prior top-right
 * collapsible button was easy to miss and overlapped the search bar
 * on narrow viewports. A persistent side rail trades a small slice of
 * left-edge real estate for instant discoverability, which matters
 * because the shapes ARE the legend's whole job — once you know what
 * they mean, the legend is reference; before then, it's invisible UI.
 *
 * Props:
 *   - title:   string ("Subcluster shapes" / "Cuisine shapes" / …)
 *   - legend:  Array<{ category: string, shape: string }>
 */

const ICON_SIZE = 16;

function ShapeIcon({ shape, color = 'currentColor' }) {
  const s = ICON_SIZE;
  const c = s / 2;
  const r = s / 2 - 1;
  switch (shape) {
    case 'sphere':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case 'cube':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <rect x="2" y="2" width={s - 4} height={s - 4} fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case 'tetrahedron':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <polygon points={`${c},2 ${s - 2},${s - 2} 2,${s - 2}`} fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case 'octahedron':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <polygon points={`${c},2 ${s - 2},${c} ${c},${s - 2} 2,${c}`} fill="none" stroke={color} strokeWidth="1.4" />
        </svg>
      );
    case 'dodecahedron':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <polygon
            points={`${c},2 ${s - 2},${s * 0.4} ${s - 3},${s - 2} 3,${s - 2} 2,${s * 0.4}`}
            fill="none"
            stroke={color}
            strokeWidth="1.4"
          />
        </svg>
      );
    case 'icosahedron':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <polygon
            points={`${c},2 ${s - 2},${s * 0.3} ${s - 2},${s * 0.7} ${c},${s - 2} 2,${s * 0.7} 2,${s * 0.3}`}
            fill="none"
            stroke={color}
            strokeWidth="1.4"
          />
        </svg>
      );
    case 'torus':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="1.4" />
          <circle cx={c} cy={c} r={r / 2.2} fill="none" stroke={color} strokeWidth="1.2" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <rect x={s * 0.3} y="2" width={s * 0.4} height={s - 4} fill="none" stroke={color} strokeWidth="1.4" />
          <ellipse cx={c} cy="3" rx={s * 0.2} ry="1.2" fill="none" stroke={color} strokeWidth="1.2" />
          <ellipse cx={c} cy={s - 3} rx={s * 0.2} ry="1.2" fill="none" stroke={color} strokeWidth="1.2" />
        </svg>
      );
    case 'cone':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <polygon points={`${c},2 ${s - 2},${s - 3} 2,${s - 3}`} fill="none" stroke={color} strokeWidth="1.4" />
          <ellipse cx={c} cy={s - 3} rx={s * 0.45} ry="1.4" fill="none" stroke={color} strokeWidth="1.2" />
        </svg>
      );
    case 'torusKnot':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <path
            d={`M ${c} 2 Q ${s - 2} ${c} ${c} ${s - 2} Q 2 ${c} ${c} 2 Z`}
            fill="none"
            stroke={color}
            strokeWidth="1.2"
          />
          <circle cx={c} cy={c} r={s * 0.18} fill="none" stroke={color} strokeWidth="1.2" />
        </svg>
      );
    case 'bipyramid':
      return (
        <svg width={s} height={s} aria-hidden="true">
          <polygon points={`${c},2 ${s - 3},${c} ${c},${s - 2} 3,${c}`} fill="none" stroke={color} strokeWidth="1.4" />
          <line x1="3" y1={c} x2={s - 3} y2={c} stroke={color} strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ShapeLegend({ title = 'Shapes', legend }) {
  if (!legend?.length) return null;

  return (
    <div
      className="fixed left-2 z-20 select-none px-2.5 py-2 rounded-md bg-[#0d0d16]/85 border border-[#2a2a3a] backdrop-blur-sm sm:top-[calc(var(--nav-h,40px)+24px)]"
      style={{
        // Mobile: sit above the iOS bottom tab bar AND clear of the
        // ClusterJoystick (which is at safe-area + 64). The shape rail
        // is short so anchoring above the joystick keeps the bottom
        // half of the screen scannable.
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 132px)',
      }}
    >
      <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5 pb-1 border-b border-[#2a2a3a]">
        {title}
      </div>
      <div className="space-y-1">
        {legend.map(({ category, shape }) => (
          <div key={category} className="flex items-center gap-2 text-[10px] text-gray-300">
            <ShapeIcon shape={shape} />
            <span>{category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
