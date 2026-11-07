/**
 * wineGlasses.jsx — one chalk glass per wine family (DESIGN-2).
 *
 *   sparkling        a tall flute, with bubbles
 *   crisp-white      a white-wine tulip
 *   aromatic-white   a taller, narrower Riesling-style glass
 *   rich-white       a wider Chardonnay bowl
 *   rose             a rosé glass with a flared lip
 *   light/medium/full-red  a red balloon whose bowl grows light → full
 *   sweet            a small dessert glass
 *   fortified        a copita / port glass
 *
 * Same look as the Cocktail Lab glasses: the wine is a colour wash in the
 * family colour, clipped to the bowl; the glass is a chalk line with a
 * faint wider stroke behind it (chalk dust) and a soft glow. Dashed when a
 * shelf glass is not selected, solid otherwise. Drawn in a 60 × 100 box
 * standing on y = 96. Decorative: aria-hidden; names stay as text.
 */
import { useId } from 'react';
import { CHALK_CREAM } from '../data/chalkTheme.js';

const CX = 30;
const BASE = 96;

// Red balloon: rim half-width, belly half-width, rim y, belly y.
function balloon(rim, belly, top, by, bottom = 62) {
  const l = CX - belly, r = CX + belly;
  return `M ${CX - rim} ${top} Q ${l} ${top + (by - top) * 0.35} ${l} ${by} Q ${l} ${bottom} ${CX} ${bottom} Q ${r} ${bottom} ${r} ${by} Q ${r} ${top + (by - top) * 0.35} ${CX + rim} ${top} Z`;
}

/**
 * Per-shape geometry: the bowl outline (closed, also the liquid clip), the
 * bowl bottom where the stem starts, the wine level, and the foot width.
 */
export const WINE_GLASS_SHAPES = {
  flute: {
    bowl: 'M 23 8 L 37 8 Q 38.5 40 34 54 Q 30 60 26 54 Q 21.5 40 23 8 Z',
    stemTop: 58, level: 18, foot: 11,
  },
  white: {
    bowl: 'M 20 22 L 40 22 Q 44 44 38 55 Q 30 63 22 55 Q 16 44 20 22 Z',
    stemTop: 61, level: 40, foot: 12,
  },
  riesling: {
    bowl: 'M 21 12 Q 19 22 18.5 34 Q 17 52 30 58 Q 43 52 41.5 34 Q 41 22 39 12 Z',
    stemTop: 58, level: 36, foot: 12,
  },
  chardonnay: {
    bowl: 'M 17 20 L 43 20 Q 50 44 41 56 Q 30 64 19 56 Q 10 44 17 20 Z',
    stemTop: 62, level: 40, foot: 14,
  },
  rose: {
    bowl: 'M 17 18 Q 22 21 21.5 30 Q 17 50 30 58 Q 43 50 38.5 30 Q 38 21 43 18 Z',
    stemTop: 58, level: 37, foot: 13,
  },
  'red-light': { bowl: balloon(10, 15, 24, 46), stemTop: 62, level: 46, foot: 13 },
  'red-medium': { bowl: balloon(11, 18, 18, 44), stemTop: 62, level: 44, foot: 14 },
  'red-full': { bowl: balloon(12, 21.5, 10, 42), stemTop: 62, level: 42, foot: 16 },
  dessert: {
    bowl: 'M 23 44 L 37 44 Q 40 56 35 63 Q 30 67 25 63 Q 20 56 23 44 Z',
    stemTop: 66, level: 52, foot: 10,
  },
  copita: {
    bowl: 'M 25.5 28 Q 23 38 23 48 Q 23 62 30 64 Q 37 62 37 48 Q 37 38 34.5 28 Z',
    stemTop: 64, level: 46, foot: 11,
  },
};

export const WINE_FAMILY_GLASS = {
  sparkling: 'flute',
  'crisp-white': 'white',
  'aromatic-white': 'riesling',
  'rich-white': 'chardonnay',
  rose: 'rose',
  'light-red': 'red-light',
  'medium-red': 'red-medium',
  'full-red': 'red-full',
  sweet: 'dessert',
  fortified: 'copita',
};

/** The glass shape key for a wine family id (white tulip if unknown). */
export function wineGlassShape(family) {
  return WINE_FAMILY_GLASS[family] || 'white';
}

/**
 * A wine family's glass. `size` is the drawing's height in px.
 * `dashed` draws the outline as a dashed chalk line (an unselected shelf
 * glass); `dim` lowers the wine wash.
 */
export function WineGlass({ family, color = '#9f1239', size = 48, dashed = false, dim = false, testid }) {
  const clip = `fn-wglass-${useId().replace(/:/g, '')}`;
  const shapeKey = wineGlassShape(family);
  const s = WINE_GLASS_SHAPES[shapeKey];
  const sparkling = shapeKey === 'flute';
  const line = CHALK_CREAM;
  const w = dashed ? 1.7 : 2.1;
  const dash = dashed ? '4 2.6' : undefined;
  const stem = `M ${CX} ${s.stemTop} L ${CX} ${BASE - 1}`;
  const foot = `M ${CX - s.foot} ${BASE} Q ${CX} ${BASE - 3.5} ${CX + s.foot} ${BASE}`;
  return (
    <svg
      width={size * 0.6} height={size} viewBox="0 0 60 100"
      aria-hidden="true" focusable="false"
      data-testid={testid || `wine-glass-${family}`} data-glass={shapeKey}
      style={{ flexShrink: 0, overflow: 'visible', filter: `drop-shadow(0 0 3px ${color}${dim ? '33' : '66'})` }}
    >
      <defs><clipPath id={clip}><path d={s.bowl} /></clipPath></defs>
      {/* the wine: a colour wash clipped to the bowl, with a brighter surface line */}
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y={s.level} width="60" height="70" fill={color} fillOpacity={dim ? 0.35 : 0.72} data-part="wine" />
        <path d={`M 0 ${s.level} L 60 ${s.level}`} stroke={color} strokeWidth="2" strokeOpacity={dim ? 0.5 : 1} />
        {sparkling && [[27, 46, 1.3], [32, 36, 1.1], [29, 27, 0.9], [33, 50, 1]].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={CHALK_CREAM} fillOpacity="0.75" />
        ))}
      </g>
      {/* chalk dust halo, then the line */}
      <g fill="none" stroke={line} strokeLinecap="round" strokeLinejoin="round">
        <path d={`${s.bowl} ${stem} ${foot}`} strokeOpacity="0.22" strokeWidth={w * 2.3} />
        <path d={s.bowl} strokeWidth={w} strokeDasharray={dash} />
        <path d={`${stem} ${foot}`} strokeWidth={w} />
        {/* a glint on the bowl */}
        <path d={`M ${CX - 6} ${s.level - 8} q -2 6 -1 12`} strokeOpacity="0.45" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
