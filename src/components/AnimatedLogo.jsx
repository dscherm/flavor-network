import { useId } from 'react';

/**
 * AnimatedLogo — chalk-rendered Neural Flavor brand mark (chef toque +
 * "Nf" nucleus + Rutherford atomic-orbit shells, drawn in chalk on a
 * chalkboard) with six animated electron dots (3 yellow + 3 purple)
 * riding three elliptical orbits via SVG <animateMotion>.
 *
 * The chalk image at `/fn-logo-chalk.png` is the static base layer
 * (provides the toque, glyph, orbit shells, and golden nucleus). The
 * SVG orbit paths themselves are invisible — they exist only as
 * motion-path references for the electrons. Path geometry is tuned
 * to roughly track the chalk-drawn shells so the dots appear to ride
 * the visible orbits without double-drawing them.
 *
 * Honors prefers-reduced-motion (dots freeze at start positions).
 */
export default function AnimatedLogo({ className = '', title = 'Neural Flavor' }) {
  // useId so two AnimatedLogos on one page don't collide on orbit IDs.
  const uid = useId().replace(/[:]/g, '');
  const o1 = `${uid}-orbit-1`;
  const o2 = `${uid}-orbit-2`;
  const o3 = `${uid}-orbit-3`;

  // Orbit center is the chalk-drawn nucleus position (~69% down a
  // square chalk image — well below image-center, since the chef
  // toque occupies the top half). The chalk rings span ~±77 wide and
  // stay flat (small minor axis); the three rings are tilted at 0°,
  // ~+40°, ~-40° to match the hand-drawn chalk angles, not ±60°.
  // rx=77, ry=20 in a 200x200 viewBox; rotation pivot is (100, 138).
  const ellipsePath = 'M 23 138 a 77 20 0 1 0 154 0 a 77 20 0 1 0 -154 0';

  const electrons = [
    { id: o1, color: '#ffd84a', dur: 6.0, begin: 0.0 },
    { id: o1, color: '#a855f7', dur: 6.0, begin: 3.0 },
    { id: o2, color: '#a855f7', dur: 5.4, begin: 0.8 },
    { id: o2, color: '#ffd84a', dur: 5.4, begin: 3.5 },
    { id: o3, color: '#ffd84a', dur: 6.6, begin: 1.6 },
    { id: o3, color: '#a855f7', dur: 6.6, begin: 4.9 },
  ];

  const orbits = [
    { id: o1, rotate: 0 },
    { id: o2, rotate: 40 },
    { id: o3, rotate: -40 },
  ];

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {/* Chalk-rendered base: chef toque + "Nf" + 3-orbit atomic model
          + golden nucleus, on a dark chalkboard. */}
      <image href="/fn-logo-chalk.png" x="0" y="0" width="200" height="200" />

      {/* Invisible orbit paths — referenced by <animateMotion> below.
          Geometry is tuned to ride the chalk-drawn shells. */}
      {orbits.map(({ id, rotate }) => (
        <path
          key={id}
          id={id}
          d={ellipsePath}
          fill="none"
          stroke="none"
          transform={`rotate(${rotate} 100 138)`}
        />
      ))}

      {/* Animated electrons. Each dot rides its orbit's path. */}
      {electrons.map((e, i) => (
        <circle
          key={`e-${i}`}
          r="3.4"
          fill={e.color}
          style={{ filter: `drop-shadow(0 0 4px ${e.color})` }}
        >
          <animateMotion
            dur={`${e.dur}s`}
            begin={`-${e.begin}s`}
            repeatCount="indefinite"
            rotate="auto"
          >
            <mpath href={`#${e.id}`} />
          </animateMotion>
        </circle>
      ))}

      {/* Reduced-motion: stop the SMIL animations. */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          animateMotion { display: none; }
        }
      `}</style>
    </svg>
  );
}
