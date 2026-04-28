import { useState } from 'react';

/**
 * ShapeLegend — discreet collapsible card explaining the per-category
 * shape mapping in the Cocktail / Sauce labs. Top-right anchored to
 * stay out of the joystick's way at the bottom and the search bar's
 * way at the top.
 *
 * Props:
 *   - title:   string ("Subcluster shapes" / "Cuisine shapes")
 *   - legend:  Array<{ category: string, shape: string }>
 *
 * The shape strings come from the master kit in src/three/Geometries.js;
 * each renders as a small inline SVG so users can quickly map what
 * they see in 3D to a category.
 */

const ICON_SIZE = 14;

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
      // Stylized trefoil — three lobes around a center (suggests the
      // twisted-ring silhouette without trying to render the real knot).
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
      // Vertical diamond — two triangles base-to-base.
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
  const [open, setOpen] = useState(false);

  if (!legend?.length) return null;

  return (
    <div className="fixed top-12 right-2 z-30 select-none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0d0d16]/85 border border-[#2a2a3a] text-[10px] uppercase tracking-wider text-gray-400 hover:text-gray-200 backdrop-blur-sm transition-colors"
        aria-expanded={open}
      >
        <ShapeIcon shape="dodecahedron" />
        {title}
        <span className={`text-[8px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="mt-1 px-3 py-2 rounded-md bg-[#0d0d16]/90 border border-[#2a2a3a] backdrop-blur-sm text-[10px] text-gray-300 space-y-1 min-w-[140px]">
          {legend.map(({ category, shape }) => (
            <div key={category} className="flex items-center gap-2">
              <ShapeIcon shape={shape} />
              <span>{category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
