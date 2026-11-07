/**
 * ChalkLogo — the Neural Flavor mark (chef's toque with "Nf" on the band,
 * over a Rutherford atom) drawn in the same chalk style as the lab icons
 * in chalkArt.jsx: a crisp chalk line over a faint, wider dust halo.
 *
 * Replaces the painted PNG (public/fn-logo-chalk.png). Because the orbits
 * are true ellipses here, the electrons can travel them again; they stop
 * under prefers-reduced-motion.
 */
import { useId } from 'react';
import { FONT, CHALK_CREAM } from '../data/chalkTheme.js';

const ORANGE = '#f2a93b';
const SAGE = '#8fa274';

const CX = 100;   // atom centre
const CY = 218;
const RX = 70;
const RY = 25;
// One ellipse as a path, so an electron can follow it with animateMotion.
const ORBIT = `M${CX - RX} ${CY} a${RX} ${RY} 0 1 0 ${RX * 2} 0 a${RX} ${RY} 0 1 0 ${-RX * 2} 0`;

const ORBITS = [
  // Drawn in this order: the orange ring first, so the green rings cross over it.
  { angle: 88, color: ORANGE, dur: '8s' },   // the upright, middle orbit
  { angle: -28, color: SAGE, dur: '7s' },
  { angle: 32, color: SAGE, dur: '9s' },
];

const CSS = `
.fn-logo-electron { display: inline; }
@media (prefers-reduced-motion: reduce) { .fn-logo-electron { display: none; } }`;

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
  const nucleus = `fn-logo-nucleus-${id}`;
  const rough = `fn-logo-rough-${id}`;

  // Toque: a tall pleated band under a puffed top that overhangs it, made
  // of three round lobes with the middle one tallest.
  const puffs = 'M70 96 C48 100 32 88 36 70 C39 52 56 44 72 50 C72 26 90 14 100 14 C110 14 128 26 128 50 C144 44 161 52 164 70 C168 88 152 100 130 96';
  const gather = 'M70 96 Q100 103 130 96';
  const lobes = 'M72 50 Q80 64 78 84 M128 50 Q120 64 122 84 M100 22 Q96 40 100 62';
  const band = 'M70 98 L68 136 Q100 141 132 136 L130 98 Q100 104 70 98 Z';
  // Vertical pleats on the band, kept clear of the "Nf".
  const pleats = 'M76 101 L75 137 M83 102 L82 138 M117 102 L118 138 M124 101 L125 137';
  const hem = 'M69 130 Q100 135 131 130';

  return (
    <svg className={className} viewBox="0 0 200 296" role="img" aria-label={title} data-testid="chalk-logo">
      <title>{title}</title>
      <style>{CSS}</style>
      <defs>
        <radialGradient id={nucleus} cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="60%" stopColor={ORANGE} />
          <stop offset="100%" stopColor="#c9761c" />
        </radialGradient>
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
          style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700 }}>Nf</text>

        {/* Rutherford atom */}
        {ORBITS.map((o) => (
          <g key={o.angle} transform={`rotate(${o.angle} ${CX} ${CY})`}>
            <Chalk d={ORBIT} c={o.color} w={3.4} />
            {animate && (
              <circle className="fn-logo-electron" r="3.6" fill={CHALK_CREAM}>
                <animateMotion dur={o.dur} repeatCount="indefinite" path={ORBIT} />
              </circle>
            )}
          </g>
        ))}
        <circle cx={CX} cy={CY} r="16" fill={ORANGE} fillOpacity="0.25" />
        <circle cx={CX} cy={CY} r="12" fill={`url(#${nucleus})`} />
        <Chalk d={`M${CX - 12} ${CY} a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0`} c="#ffd27a" w={1.2} opacity={0.7} />
      </g>
    </svg>
  );
}
