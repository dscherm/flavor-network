/**
 * ChalkLogo — the Neural Flavor mark: a chef's toque capping a conical flask
 * whose "Nf" sits on a cream label centred on the glass, drawn in the same chalk style as the lab icons
 * in chalkArt.jsx: a crisp chalk line over a faint, wider dust halo.
 *
 * The hat is the stopper on the flask's neck. Three bubbles rise up the sides
 * of the label through the chalk-blue liquid; they stay drawn and still under prefers-reduced-motion.
 */
import { useId } from 'react';
import { LOGO_HAND, CHALK_CREAM, LOGO_LIQUID } from '../data/chalkTheme.js';

const BLUE = LOGO_LIQUID;
const SLATE_INK = '#0a0a0a';
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

const BUBBLES = [[64, 278, 3.4], [136, 270, 3], [132, 281, 2.4]];
const LABEL = { x: 74, y: 216, w: 52, h: 40 };

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
  const pleats = 'M76 101 L75 137 M83 102 L82 138 M117 102 L118 138 M124 101 L125 137';
  const centrePleats = 'M92 103 L91.5 139 M100 104 L100 140 M108 103 L108.5 139';
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
        <Chalk d={centrePleats} c={CHALK_CREAM} w={1.3} opacity={0.5} />
        <Chalk d={hem} c={CHALK_CREAM} w={1.2} opacity={0.45} />
        <Chalk d={puffs} c={CHALK_CREAM} w={3.2} />
        <Chalk d={gather} c={CHALK_CREAM} w={2.2} opacity={0.85} />
        <Chalk d={band} c={CHALK_CREAM} w={3} />

        {/* Conical flask under the hat */}
        <g data-part="flask">
          <path d="M69.5 206 Q100 211 130.5 206 L160 274 Q164 284 150 284 L50 284 Q36 284 40 274 Z" fill={BLUE} fillOpacity={0.62} />
          <Chalk d="M69.5 206 Q100 211 130.5 206" c={BLUE} w={2.2} opacity={0.95} />
          {BUBBLES.map(([x, y, r], i) => (
            <circle key={i} data-part="bubble" className={animate ? `fn-logo-bubble b${i + 1}` : undefined}
              cx={x} cy={y} r={r} fill={CHALK_CREAM} fillOpacity={0.85} />
          ))}
          <Chalk d="M126 192 L144 236" c={CHALK_CREAM} w={1.3} opacity={0.4} />
          <rect data-part="label" x={LABEL.x} y={LABEL.y} width={LABEL.w} height={LABEL.h} rx={3} fill={CHALK_CREAM} />
          <Chalk d={`M${LABEL.x} ${LABEL.y} H${LABEL.x + LABEL.w} V${LABEL.y + LABEL.h} H${LABEL.x} Z`} c={CHALK_CREAM} w={1.4} opacity={0.9} />
          <text x="100" y="246.8" textAnchor="middle" fill={SLATE_INK}
            style={{ fontFamily: LOGO_HAND, fontSize: 36, fontWeight: 700 }}>Nf</text>
          <Chalk d="M76 144 Q81 145 82 150 L82 178 L40 272 Q35 286 52 286 L148 286 Q165 286 160 272 L118 178 L118 150 Q119 145 124 144" c={SAGE} w={3.4} />
        </g>
      </g>
    </svg>
  );
}
