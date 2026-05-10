import { useId } from 'react';

/**
 * AnimatedLogo — pure-SVG recreation of the Neural Flavor brand mark
 * (chef hat above an atomic-orbit "Nf" nucleus). Yellow and purple
 * electron dots ride three elliptical orbits via SVG <animateMotion>,
 * so animation cost is GPU-side and Vite can leave the SVG inline.
 *
 * Honors prefers-reduced-motion (dots freeze at their starting
 * positions, static dots remain visible). Sized to its container; the
 * intrinsic aspect is 5:6 (200x240).
 */
export default function AnimatedLogo({ className = '', title = 'Neural Flavor' }) {
  // useId so two AnimatedLogos on one page (e.g. landing + a future
  // about screen) don't share orbit path IDs.
  const uid = useId().replace(/[:]/g, '');
  const o1 = `${uid}-orbit-1`;
  const o2 = `${uid}-orbit-2`;
  const o3 = `${uid}-orbit-3`;

  // Orbit path: ellipse rx=72, ry=30 centered at (100, 170).
  const ellipsePath = 'M 28 170 a 72 30 0 1 0 144 0 a 72 30 0 1 0 -144 0';

  // Each electron: { orbitId, color, dur, begin }
  const electrons = [
    { id: o1, color: '#ffd84a', dur: 6.0, begin: 0.0 },
    { id: o1, color: '#a855f7', dur: 6.0, begin: 3.0 },
    { id: o2, color: '#a855f7', dur: 5.4, begin: 0.8 },
    { id: o2, color: '#ffd84a', dur: 5.4, begin: 3.5 },
    { id: o3, color: '#ffd84a', dur: 6.6, begin: 1.6 },
    { id: o3, color: '#a855f7', dur: 6.6, begin: 4.9 },
  ];

  // Each orbit is wrapped in a <g rotate> so the path's local coords
  // (used by <animateMotion>) stay axis-aligned — simplest way to keep
  // the dot riding the visible ellipse exactly.
  const orbits = [
    { id: o1, rotate: 0 },
    { id: o2, rotate: 60 },
    { id: o3, rotate: -60 },
  ];

  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {/* Chef toque silhouette — single closed path with cubic beziers
          designed for tangent-continuous (rounded U-shape) valleys
          between three distinct cloud puffs.
            Anchors (peaks/valleys) with horizontal tangent at each:
              L peak  (62, 8)
              LM val  (84, 24)
              M peak  (100, -2)   ← middle puff is taller
              MR val  (116, 24)
              R peak  (138, 8)
          Each adjacent pair of control points sits at the same y as
          its anchor, so the tangents match → no V-shaped notches. */}
      <path
        d="
          M 56 56
          C 56 32, 58 8, 62 8
          C 70 8, 76 24, 84 24
          C 90 24, 94 -2, 100 -2
          C 106 -2, 110 24, 116 24
          C 122 24, 130 8, 138 8
          C 142 8, 144 32, 144 56
          L 144 84
          Q 144 92, 136 92
          L 64 92
          Q 56 92, 56 84
          Z
        "
        fill="#0d1f38"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Band-top stripe between the puff valleys (visible inside the
          two LM and MR dips, plus the small slivers at the far left
          and right where the puffs leave the band-top exposed). */}
      <line x1="56" y1="56" x2="144" y2="56" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      {/* Cuff stripe inside the band */}
      <line x1="58" y1="74" x2="142" y2="74" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

      {/* Three orbits + their electron dots. Each orbit rotates in
          its own group; the dot inside inherits the rotation. */}
      {orbits.map(({ id, rotate }) => (
        <g key={id} transform={`rotate(${rotate} 100 170)`}>
          <path
            id={id}
            d={ellipsePath}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            opacity="0.92"
          />
        </g>
      ))}

      {/* Nucleus: "Nf" glyph centered. Slightly raised so the glyph
          sits visually inside the orbit overlap, not on top of it. */}
      <text
        x="100"
        y="180"
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        fill="#ffffff"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        letterSpacing="-1"
      >
        Nf
      </text>

      {/* Static "marker" dots from the source render — small white dot
          near top of orbit-1 and small orange dot near the bottom of
          orbit-2. They don't move; the animated electrons do. */}
      <circle cx="100" cy="138" r="3.6" fill="#e8f3ff" stroke="#0d1f38" strokeWidth="0.6" />
      <circle cx="100" cy="202" r="3.6" fill="#ff8c42" stroke="#0d1f38" strokeWidth="0.6" />

      {/* Animated electrons. Each dot is a child of its orbit's
          rotation group so the motion path matches the visible
          ellipse exactly. */}
      {orbits.map(({ id, rotate }) => {
        const orbitElectrons = electrons.filter((e) => e.id === id);
        return (
          <g key={`e-${id}`} transform={`rotate(${rotate} 100 170)`}>
            {orbitElectrons.map((e, i) => (
              <circle
                key={i}
                r="4.2"
                fill={e.color}
                style={{ filter: `drop-shadow(0 0 4px ${e.color})` }}
              >
                <animateMotion
                  dur={`${e.dur}s`}
                  begin={`-${e.begin}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                >
                  <mpath href={`#${id}`} />
                </animateMotion>
              </circle>
            ))}
          </g>
        );
      })}

      {/* Reduced-motion: stop the SMIL animations. CSS can't pause
          <animateMotion>, so we use a media query inside <style>. */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          animateMotion { display: none; }
        }
      `}</style>
    </svg>
  );
}
