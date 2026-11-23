// The one UI icon set (LOOK-4). Hand-drawn chalk: every stroke is drawn twice, a faint wider
// dust halo (2.2x, 25% opacity) under a crisp line, round ends, the wobble drawn into the path.
// One ink (currentColor), no fill, no filter. Sizes in use: 16, 20, 24 only.
// Each icon is its own named export. Pass `title` to give it an accessible name; otherwise it is
// decorative (aria-hidden) and the control around it carries the name.
import React from 'react';

function drawn(name, strokes, dots, { size = 20, title, label, 'aria-hidden': hidden, className, style } = {}) {
  const core = (1.5 * 24) / size;
  const accessible = !hidden && (title || label);
  const common = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      data-icon={name}
      focusable="false"
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...(accessible ? { role: 'img', 'aria-label': accessible } : { 'aria-hidden': 'true' })}
    >
      {accessible ? <title>{accessible}</title> : null}
      {strokes.map((d, i) => (
        <g key={i}>
          <path d={d} stroke="currentColor" strokeOpacity={0.25} strokeWidth={core * 2.2} {...common} />
          <path d={d} stroke="currentColor" strokeWidth={core} {...common} />
        </g>
      ))}
      {dots.map(([cx, cy, r], i) => (
        <circle key={`d${i}`} cx={cx} cy={cy} r={r} fill="currentColor" />
      ))}
    </svg>
  );
}

const CHEVRON = {
  left: ['M14.6 5.2 Q9.5 9.2 8.4 11.8 Q10 14.6 15.2 18.8'],
  right: ['M9.4 5.2 Q14.5 9.2 15.6 11.8 Q14 14.6 8.8 18.8'],
  down: ['M5.2 9.4 Q9.2 14.5 11.8 15.6 Q14.6 14 18.8 8.8'],
  up: ['M5.2 14.6 Q9.2 9.5 11.8 8.4 Q14.6 10 18.8 15.2'],
};

export const ChevronLeft = (p) => drawn('chevron-left', CHEVRON.left, [], p);
export const ChevronRight = (p) => drawn('chevron-right', CHEVRON.right, [], p);
export const ChevronDown = (p) => drawn('chevron-down', CHEVRON.down, [], p);
export const ChevronUp = (p) => drawn('chevron-up', CHEVRON.up, [], p);

export const Close = (p) =>
  drawn('close', ['M6.2 5.8 Q12 11.6 18.2 18.4', 'M17.6 5.4 Q12.4 11.2 6.4 18'], [], p);

export const Search = (p) =>
  drawn(
    'search',
    [
      'M10.5 4.6 C14 4.4 16.6 7.2 16.3 10.6 C16 14 13.4 16.4 10 16.2 C6.8 16 4.5 13.4 4.8 10.2 C5 7.2 7.4 4.9 10.8 4.9 L12.2 4.4',
      'M14.6 15 Q17.4 17.8 19.4 19.8',
    ],
    [],
    p,
  );

export const Filters = (p) =>
  drawn('filters', ['M4 7 Q9 6.4 20 7', 'M4 12 Q8 12.6 16 12', 'M4 17 Q7 16.5 12 17'], [], p);

export const Share = (p) =>
  drawn(
    'share',
    [
      'M5 12 L5.2 18.6 Q12 19.4 18.8 18.6 L19 12',
      'M12 15 Q12.4 9 12 4.6',
      'M8.4 8 Q10.6 6 12 4.4 Q13.4 6 15.8 7.8',
    ],
    [],
    p,
  );

export const Basket = (p) =>
  drawn(
    'basket',
    [
      'M4.4 10.6 L6.4 19.2 Q12 19.8 17.6 19.2 L19.6 10.6 Q12 11.2 4.4 10.6',
      'M5.4 14.2 Q12 14.8 18.6 14.2',
      'M12 11 Q12.3 15 12 19.5',
      'M7.6 10.4 Q9 4.6 12 4.6 Q15 4.6 16.4 10.4',
    ],
    [],
    p,
  );

export const Camera = (p) =>
  drawn(
    'camera',
    [
      'M3.6 8.6 L3.9 18.6 Q12 19.2 20.2 18.6 L20.4 8.6 Q17 8.7 16.4 8.4 L15 6 Q12 5.7 9.2 6 L7.8 8.4 Q5 8.8 3.6 8.6',
      'M12 10.4 C14 10.3 15.7 12 15.6 13.8 C15.5 15.6 13.8 17 12 16.9 C10.2 16.8 8.4 15.4 8.5 13.6 C8.6 11.8 10.4 10.4 12 10.4',
    ],
    [[17.8, 10.9, 1.1]],
    p,
  );

export const Shaker = (p) =>
  drawn(
    'shaker',
    [
      'M9.8 5.4 Q10 3.4 12 3.4 Q14 3.4 14.2 5.4',
      'M8.2 5.6 Q12 5.2 15.8 5.6 L15.6 8.2 Q12 8.6 8.4 8.2 Z',
      'M8.4 8.4 L7.2 19.6 Q12 20.4 16.8 19.6 L15.6 8.4',
    ],
    [],
    p,
  );

export const Whisk = (p) =>
  drawn(
    'whisk',
    [
      'M12 20.6 Q12.2 17 12 14.6',
      'M10.6 15.4 Q12 15.8 13.4 15.4',
      'M12 14.6 C7.4 12.4 7.4 6.6 12 3.8',
      'M12 14.6 C16.6 12.4 16.6 6.6 12 3.8',
      'M12 14.6 C9.8 12 9.8 7.4 12 3.8',
      'M12 14.6 C14.2 12 14.2 7.4 12 3.8',
    ],
    [],
    p,
  );

export const Checkbox = ({ checked = false, ...p }) =>
  drawn(
    checked ? 'checkbox-checked' : 'checkbox',
    [
      'M12 4.2 C16.4 4.1 19.8 7.5 19.7 12 C19.6 16.4 16.2 19.8 11.8 19.7 C7.6 19.6 4.2 16.2 4.3 11.9 C4.4 8 7.4 4.6 11 4.3',
      ...(checked ? ['M8.2 12.2 Q10 13.6 11.2 15.4 Q14.6 9.6 20.2 4.6'] : []),
    ],
    [],
    p,
  );

export const More = (p) =>
  drawn(
    'more',
    [],
    [
      [6, 12, 1.5],
      [12, 12, 1.5],
      [18, 12, 1.5],
    ],
    p,
  );

export const Home = (p) =>
  drawn(
    'home',
    [
      'M3.6 11.6 Q8 7.6 12.2 3.8 Q16 7.6 20.6 11.4',
      'M5.6 10.4 L5.8 19.6 Q12 20.2 18.2 19.6 L18.4 10.4',
      'M10.2 19.8 L10.2 14.6 Q12 14.2 13.8 14.6 L13.8 19.7',
    ],
    [],
    p,
  );

export const Person = (p) =>
  drawn(
    'person',
    [
      'M12 4.4 C14.4 4.3 15.8 6 15.7 8 C15.6 10 14 11.6 12 11.5 C10 11.4 8.4 9.9 8.5 7.9 C8.6 5.9 10 4.5 12 4.4',
      'M4.8 19.8 Q5.4 14.6 12 14.4 Q18.6 14.6 19.2 19.8',
    ],
    [],
    p,
  );

export const Labs = (p) =>
  drawn(
    'labs',
    [
      'M5 4.4 Q12 4 19 4.4 L18.8 14.4 Q12 14.8 5.2 14.4 Z',
      'M7.6 7.6 Q10 7.3 12.4 7.6',
      'M7.6 10 Q11 9.7 16 10',
      'M7.6 12.2 Q9 12 10.6 12.2',
      'M8 14.8 L6.4 20.4',
      'M16 14.8 L17.6 20.4',
    ],
    [],
    p,
  );

export const Help = (p) =>
  drawn(
    'help',
    [
      'M12 3.4 C16.8 3.3 20.7 7.2 20.6 12 C20.5 16.8 16.6 20.7 11.9 20.6 C7.2 20.5 3.3 16.7 3.4 11.9 C3.5 7.4 7.2 3.6 11.6 3.4',
      'M9.4 9.6 Q9.6 7.6 12 7.6 Q14.4 7.7 14.4 9.8 Q14.4 11.2 12.4 12.2 Q12 12.8 12 13.6',
    ],
    [[12, 16.4, 1.2]],
    p,
  );

// Not icons (lower case on purpose: these are drawing helpers, not part of the icon set).
// chalkUnderline: the short drawn mark under the current tab label. chalkRule: an uneven 1 px chalk line.
export function chalkUnderline({ width = 22, style } = {}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={6} viewBox="0 0 22 6" aria-hidden="true" focusable="false"
      data-chalk="underline" style={{ display: 'block', overflow: 'visible', ...style }}>
      <path d="M1 3.6 Q11 2 21 3.2" stroke="currentColor" strokeOpacity={0.25} strokeWidth={4.4} fill="none" strokeLinecap="round" />
      <path d="M1 3.6 Q11 2 21 3.2" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function chalkRule({ style } = {}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height={3} viewBox="0 0 400 3" preserveAspectRatio="none"
      aria-hidden="true" focusable="false" data-chalk="rule" style={{ display: 'block', ...style }}>
      <path d="M0 1.6 Q40 0.9 80 1.7 T160 1.4 T240 1.8 T320 1.3 T400 1.6" stroke="currentColor" strokeWidth={1}
        vectorEffect="non-scaling-stroke" fill="none" strokeLinecap="round" />
    </svg>
  );
}
