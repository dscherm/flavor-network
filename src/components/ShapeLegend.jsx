/**
 * ShapeLegend — dual-mode legend / fly-to wheel for the cocktail and
 * sauce labs.
 *
 *  - **Desktop**: vertical rail anchored to the LEFT edge of the
 *    viewport (the original design — discoverable, doesn't crowd the
 *    canvas).
 *  - **Mobile**: horizontal pill strip 10px above the ClusterJoystick,
 *    same visual language as the family fly-to wheel. When `onSelect`
 *    is wired, tapping a shape filters the scene to nodes matching
 *    that category — non-matching nodes dim and only matching nodes
 *    accept clicks (mirroring the network ClusterJoystick filter
 *    behavior). Tapping an active pill clears the filter.
 *
 * Props:
 *   - title:       string ("Subcluster shapes" / "Cuisine shapes" / …)
 *   - legend:      Array<{ category: string, shape: string }>
 *   - selectedKey: string | null   (active filter; provided by parent)
 *   - onSelect:    (key|null) => void   (parent stores filter state)
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

export default function ShapeLegend({ title = 'Shapes', legend, selectedKey = null, onSelect = null }) {
  if (!legend?.length) return null;

  const interactive = typeof onSelect === 'function';

  // Tap behavior — toggle off on second press of the active pill.
  function handleTap(category) {
    if (!interactive) return;
    onSelect(selectedKey === category ? null : category);
  }

  return (
    <>
      {/* Mobile horizontal fly-to wheel — sits 10px above the
          ClusterJoystick (which is at tab-bar-h + 10) so the bottom
          stack reads, edge up: tab bar → joystick → legend wheel. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[68] select-none pointer-events-none sm:hidden"
        style={{
          bottom: 'calc(var(--tab-bar-h) + 70px)',
          maxWidth: 'calc(100vw - 1rem)',
        }}
        aria-label={`Filter by ${title.toLowerCase()}`}
      >
        <div
          className="bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] px-2 py-1 shadow-lg pointer-events-auto overflow-x-auto"
          style={{ scrollbarWidth: 'none', borderRadius: 18 }}
        >
          <div className="flex items-center gap-1 flex-nowrap">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 pr-1 whitespace-nowrap flex-shrink-0">
              {title.replace(/ shapes$/i, '')}
            </span>
            {legend.map(({ category, shape }) => {
              const isActive = selectedKey === category;
              return (
                <button
                  key={category}
                  onClick={() => handleTap(category)}
                  onTouchStart={(e) => { e.preventDefault(); handleTap(category); }}
                  title={interactive
                    ? (isActive ? `Clear ${category} filter` : `Show only ${category}`)
                    : category}
                  className={`flex items-center gap-1 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-full text-[11px] sm:text-[10px] whitespace-nowrap transition-colors flex-shrink-0 capitalize ${
                    interactive ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)'}`,
                    color: isActive ? '#fff' : '#cbd5e1',
                  }}
                  disabled={!interactive}
                >
                  <ShapeIcon shape={shape} color={isActive ? '#fff' : '#cbd5e1'} />
                  <span>{category}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop vertical rail — anchored top-left, original design. */}
      <div
        className="hidden sm:block fixed left-2 z-[60] select-none px-2.5 py-2 rounded-md bg-[#0d0d16]/85 border border-[#2a2a3a] backdrop-blur-sm"
        style={{ top: 'calc(var(--nav-h, 40px) + 24px)' }}
      >
        <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1.5 pb-1 border-b border-[#2a2a3a]">
          {title}
        </div>
        <div className="space-y-1">
          {legend.map(({ category, shape }) => {
            const isActive = selectedKey === category;
            const node = (
              <div
                className="flex items-center gap-2 text-[10px] transition-colors"
                style={{ color: isActive ? '#fff' : '#d1d5db' }}
              >
                <ShapeIcon shape={shape} color={isActive ? '#fff' : 'currentColor'} />
                <span className={isActive ? 'font-medium' : ''}>{category}</span>
              </div>
            );
            if (!interactive) return <div key={category}>{node}</div>;
            return (
              <button
                key={category}
                onClick={() => handleTap(category)}
                className="w-full text-left px-1 py-0.5 rounded hover:bg-white/5 transition-colors"
                title={isActive ? `Clear ${category} filter` : `Show only ${category}`}
              >
                {node}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
