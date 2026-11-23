/**
 * ChalkLogo — the Neural Flavor mark: a chef's toque with "Nf" on the band,
 * capping a conical flask, drawn in the same chalk style as the lab icons
 * in chalkArt.jsx: a crisp chalk line over a faint, wider dust halo.
 *
 * The hat is the stopper on the flask's neck. Three bubbles rise through the
 * orange liquid; they stay drawn and still under prefers-reduced-motion.
 */
import { useId } from 'react';
import { LOGO_HAND, CHALK_CREAM } from '../data/chalkTheme.js';

const ORANGE = '#f2a93b';
const SAGE = '#8fa274';

const CSS = `
.fn-logo-bubble { animation: fn-logo-rise 3.4s ease-in infinite; transform-box: fill-box; }
.fn-logo-bubble.b2 { animation-delay: 1.1s; }
.fn-logo-bubble.b3 { animation-delay: 2.2s; }
@keyframes fn-logo-rise {
  0% { transform: translateY(0); opacity: 0; }
  15% { opacity: .9; }
  80% { opacity: .9; }
  100% { transform: translateY(-38px); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .fn-logo-bubble { animation: none; } }`;

const BUBBLES = [[84, 272, 3.6], [106, 262, 3], [122, 276, 2.6]];

function Chalk({ d, c, w = 3, halo = 2.4, opacity = 1 }) {
  return (
    <>
      <path d={d} fill="none" stroke={c} strokeOpacity={0.22 * opacity} strokeWidth={w * halo} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={c} strokeOpacity={opacity} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

export default function ChalkLogo({ className = '', title = 'Neural Flavor', animate = true }) {
  const id = useId().replace(/:/g, '');
  const rough = `fn-logo-rough-${id}`;

  // Toque: a tall pleated band under a puffed top that overhangs it, made
  // of three round lobes with the middle one tallest.
  const puffs = 'M70 96 C48 100 32 88 36 70 C39 52 56 44 72 50 C73 34 90 28 100 28 C110 28 127 34 128 50 C144 44 161 52 164 70 C168 88 152 100 130 96';
  const gather = 'M70 96 Q100 103 130 96';
  const lobes = 'M72 50 Q80 64 78 84 M128 50 Q120 64 122 84 M100 36 Q97 50 100 66';
  const band = 'M70 98 L68 136 Q100 141 132 136 L130 98 Q100 104 70 98 Z';
  // Vertical pleats on the band, kept clear of the "Nf".
  const pleats = 'M76 101 L75 137 M83 102 L82 138 M117 102 L118 138 M124 101 L125 137';
  const hem = 'M69 130 Q100 135 131 130';

  return (
    <svg className={className} viewBox="0 16 200 280" role="img" aria-label={title} data-testid="chalk-logo">
      <title>{title}</title>
      <style>{CSS}</style>
      <defs>
        {/* Slightly broken edges, so lines read as chalk rather than vector strokes. */}
        <filter id={rough} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
        </filter>
      </defs>
      <g filter={`url(#${rough})`}>

        {/* Chef's toque */}
        <path d={puffs} fill={CHALK_CREAM} fillOpacity={0.05} />
        <path d={band} fill={CHALK_CREAM} fillOpacity={0.07} />
        <Chalk d={lobes} c={CHALK_CREAM} w={1.6} opacity={0.6} />
        <Chalk d={pleats} c={CHALK_CREAM} w={1.3} opacity={0.5} />
        <Chalk d={hem} c={CHALK_CREAM} w={1.2} opacity={0.45} />
        <Chalk d={puffs} c={CHALK_CREAM} w={3.2} />
        <Chalk d={gather} c={CHALK_CREAM} w={2.2} opacity={0.85} />
        <Chalk d={band} c={CHALK_CREAM} w={3} />
        <text x="100" y="128" textAnchor="middle" fill={ORANGE}
          style={{ fontFamily: LOGO_HAND, fontSize: 32, fontWeight: 700 }}>Nf</text>

        {/* Conical flask under the hat */}
        <g data-part="flask">
          <path d="M61 228 Q100 233 139 228 L160 274 Q164 284 150 284 L50 284 Q36 284 40 274 Z" fill={ORANGE} fillOpacity={0.6} />
          <Chalk d="M61 228 Q100 233 139 228" c={ORANGE} w={2.2} opacity={0.95} />
          {BUBBLES.map(([x, y, r], i) => (
            <circle key={i} data-part="bubble" className={animate ? `fn-logo-bubble b${i + 1}` : undefined}
              cx={x} cy={y} r={r} fill={CHALK_CREAM} fillOpacity={0.85} />
          ))}
          <Chalk d="M92 196 L108 196 M95 212 L105 212 M90 244 L110 244 M95 260 L105 260" c={CHALK_CREAM} w={1.3} opacity={0.55} />
          <Chalk d="M60 248 L76 248 L76 262 L56 262" c={CHALK_CREAM} w={1.2} opacity={0.45} />
          <Chalk d="M124 192 L144 238" c={CHALK_CREAM} w={1.3} opacity={0.4} />
          <Chalk d="M76 144 Q81 145 82 150 L82 178 L40 272 Q35 286 52 286 L148 286 Q165 286 160 272 L118 178 L118 150 Q119 145 124 144" c={SAGE} w={3.4} />
        </g>
      </g>
    </svg>
  );
}
