/**
 * sauceVessels.jsx — the Sauce Lab's chalk vessels, one per mother family
 * (saucepan for Béchamel, ladle for Velouté, mortar for Curry, …). Drawn on
 * the family shelf in SauceBrowse, and beside each sauce in the pantry and
 * Invent panels. Decorative: every standalone drawing is aria-hidden.
 */
import { CHALK_CREAM } from '../data/chalkTheme.js';

// v1.0.4: dark family colours (Espagnole brown, Mole) vanish as text or outline
// on the near-black card. Lift anything below a luminance floor toward chalk
// cream; bright families pass through unchanged.
export function popColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.5) return hex;
  const t = Math.min(0.65, (0.5 - lum) * 1.8);
  const mix = (c, target) => Math.round(c + (target - c) * t);
  return `#${[mix(r, 245), mix(g, 239), mix(b, 222)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
// Each mother family gets a DISTINCT signature vessel by name keyword (order
// matters; first hit wins). Generic gravy boat is the fallback.
const VESSEL_BY_FAMILY = [
  { rx: /b[ée]chamel/i,                          vessel: 'saucepan' }, // creamy → pot
  { rx: /velout|veloute/i,                        vessel: 'ladle' },    // stock → ladle
  { rx: /espagnole|demi|brown/i,                  vessel: 'boat' },     // brown → gravy boat
  { rx: /hollandaise|b[ée]arnaise|emulsion/i,     vessel: 'bowl' },     // whisked → mixing bowl
  { rx: /tomato|tomate|marinara|ketchup/i,        vessel: 'bottle' },   // condiment bottle
  { rx: /curry/i,                                 vessel: 'mortar' },   // mortar & pestle
  { rx: /stir.?fry|wok|soy|teriyaki/i,            vessel: 'wok' },      // wok
  { rx: /mole/i,                                  vessel: 'jug' },      // pitcher
  { rx: /salsa|pico|relish/i,                     vessel: 'jar' },      // mason jar
  { rx: /nut|peanut|satay|romesco|tahini/i,       vessel: 'carafe' },   // decanter
  { rx: /independent|misc|other|vinaigrette|oil/i, vessel: 'cruet' },   // cruet
];
export function sauceVesselFor(name = '') {
  for (const { rx, vessel } of VESSEL_BY_FAMILY) if (rx.test(name)) return vessel;
  return 'boat';
}

/**
 * Draw a chalk sauce vessel centered horizontally at `bx`, standing on the
 * shelf at `by`. Returns SVG (liquid fill + chalk outline). Dashed when
 * inactive, solid when active.
 */
export function vesselMark(kind, bx, by, color, stroke, active) {
  const fillOp = active ? 0.6 : 0.32;
  const sw = active ? 2.2 : 1.5;
  const dash = active ? '0' : '5 3';
  const fill = (d) => <path d={d} fill={color} fillOpacity={fillOp} stroke="none" />;
  const out = (d) => <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round" />;
  const dot = (cx, cy, r) => <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={sw} />;
  switch (kind) {
    case 'bottle': // condiment / ketchup bottle
      return (<>
        {fill(`M ${bx - 9} ${by - 12} L ${bx + 9} ${by - 12} L ${bx + 9} ${by - 1} L ${bx - 9} ${by - 1} Z`)}
        {out(`M ${bx - 11} ${by} L ${bx - 11} ${by - 30} Q ${bx - 11} ${by - 37} ${bx - 5} ${by - 39} L ${bx - 5} ${by - 45} L ${bx + 5} ${by - 45} L ${bx + 5} ${by - 39} Q ${bx + 11} ${by - 37} ${bx + 11} ${by - 30} L ${bx + 11} ${by} Z`)}
        {out(`M ${bx - 5} ${by - 45} L ${bx - 5} ${by - 50} L ${bx + 5} ${by - 50} L ${bx + 5} ${by - 45}`)}
      </>);
    case 'jar': // mason jar
      return (<>
        {fill(`M ${bx - 13} ${by - 14} L ${bx + 13} ${by - 14} L ${bx + 13} ${by - 1} L ${bx - 13} ${by - 1} Z`)}
        {out(`M ${bx - 15} ${by} L ${bx - 15} ${by - 30} L ${bx - 12} ${by - 35} L ${bx - 12} ${by - 40} L ${bx + 12} ${by - 40} L ${bx + 12} ${by - 35} L ${bx + 15} ${by - 30} L ${bx + 15} ${by} Z`)}
        {out(`M ${bx - 13} ${by - 40} L ${bx - 13} ${by - 47} L ${bx + 13} ${by - 47} L ${bx + 13} ${by - 40}`)}
      </>);
    case 'mortar': // mortar & pestle
      return (<>
        {fill(`M ${bx - 18} ${by - 20} Q ${bx} ${by + 2} ${bx + 18} ${by - 20} Z`)}
        {out(`M ${bx - 22} ${by - 22} L ${bx + 22} ${by - 22}`)}
        {out(`M ${bx - 20} ${by - 22} Q ${bx} ${by + 8} ${bx + 20} ${by - 22}`)}
        {out(`M ${bx - 9} ${by + 5} Q ${bx} ${by + 8} ${bx + 9} ${by + 5}`)}
        {out(`M ${bx + 7} ${by - 20} L ${bx + 19} ${by - 46}`)}
        {dot(bx + 19, by - 47, 3.2)}
      </>);
    case 'wok': // stir-fry pan
      return (<>
        {fill(`M ${bx - 19} ${by - 16} Q ${bx} ${by + 1} ${bx + 19} ${by - 16} Z`)}
        {out(`M ${bx - 24} ${by - 18} L ${bx + 22} ${by - 18}`)}
        {out(`M ${bx - 22} ${by - 18} Q ${bx} ${by + 6} ${bx + 22} ${by - 18}`)}
        {out(`M ${bx + 22} ${by - 18} L ${bx + 38} ${by - 22}`)}
      </>);
    case 'cruet': // narrow stoppered cruet
      return (<>
        {fill(`M ${bx - 7} ${by - 12} L ${bx + 7} ${by - 12} L ${bx + 7} ${by - 1} L ${bx - 7} ${by - 1} Z`)}
        {out(`M ${bx - 9} ${by} L ${bx - 9} ${by - 24} Q ${bx - 9} ${by - 31} ${bx - 4} ${by - 35} L ${bx - 4} ${by - 41} L ${bx + 4} ${by - 41} L ${bx + 4} ${by - 35} Q ${bx + 9} ${by - 31} ${bx + 9} ${by - 24} L ${bx + 9} ${by} Z`)}
        {dot(bx, by - 45, 3.4)}
      </>);
    case 'saucepan': // pot with lid + side handle
      return (<>
        {fill(`M ${bx - 16} ${by - 12} L ${bx + 16} ${by - 12} L ${bx + 16} ${by - 1} L ${bx - 16} ${by - 1} Z`)}
        {out(`M ${bx - 18} ${by} L ${bx - 18} ${by - 22} L ${bx + 18} ${by - 22} L ${bx + 18} ${by} Z`)}
        {out(`M ${bx - 20} ${by - 22} L ${bx + 20} ${by - 22}`)}
        {out(`M ${bx - 13} ${by - 22} Q ${bx} ${by - 35} ${bx + 13} ${by - 22}`)}
        {dot(bx, by - 35, 2.6)}
        {out(`M ${bx + 18} ${by - 16} L ${bx + 35} ${by - 18}`)}
      </>);
    case 'ladle': // cup bowl on a hooked handle
      return (<>
        {fill(`M ${bx - 11} ${by - 10} Q ${bx} ${by + 4} ${bx + 11} ${by - 10} Z`)}
        {out(`M ${bx - 13} ${by - 12} L ${bx + 13} ${by - 12}`)}
        {out(`M ${bx - 13} ${by - 12} Q ${bx} ${by + 8} ${bx + 13} ${by - 12}`)}
        {out(`M ${bx + 8} ${by - 11} L ${bx + 18} ${by - 44} Q ${bx + 18} ${by - 50} ${bx + 12} ${by - 49}`)}
      </>);
    case 'bowl': // wide mixing bowl + whisk
      return (<>
        {fill(`M ${bx - 20} ${by - 16} Q ${bx} ${by + 4} ${bx + 20} ${by - 16} Z`)}
        {out(`M ${bx - 23} ${by - 18} L ${bx + 23} ${by - 18}`)}
        {out(`M ${bx - 22} ${by - 18} Q ${bx} ${by + 9} ${bx + 22} ${by - 18}`)}
        {out(`M ${bx + 5} ${by - 16} L ${bx + 14} ${by - 44}`)}
        {out(`M ${bx + 1} ${by - 16} Q ${bx + 5} ${by - 8} ${bx + 9} ${by - 16}`)}
        {out(`M ${bx + 3} ${by - 19} Q ${bx + 6} ${by - 12} ${bx + 9} ${by - 19}`)}
      </>);
    case 'jug': // pitcher with spout + handle
      return (<>
        {fill(`M ${bx - 13} ${by - 12} L ${bx + 13} ${by - 12} L ${bx + 13} ${by - 1} L ${bx - 13} ${by - 1} Z`)}
        {out(`M ${bx - 15} ${by} L ${bx - 15} ${by - 26} Q ${bx - 15} ${by - 33} ${bx - 9} ${by - 35} L ${bx + 9} ${by - 35} Q ${bx + 15} ${by - 33} ${bx + 15} ${by - 26} L ${bx + 15} ${by} Z`)}
        {out(`M ${bx - 15} ${by - 31} L ${bx - 23} ${by - 35}`)}
        {out(`M ${bx + 15} ${by - 30} q 11 2 10 13 q -1 7 -10 6`)}
      </>);
    case 'carafe': // rounded decanter with stopper
      return (<>
        {fill(`M ${bx - 14} ${by - 14} Q ${bx - 15} ${by} ${bx} ${by} Q ${bx + 15} ${by} ${bx + 14} ${by - 14} Z`)}
        {out(`M ${bx - 6} ${by - 36} L ${bx - 6} ${by - 30} Q ${bx - 16} ${by - 24} ${bx - 16} ${by - 12} Q ${bx - 16} ${by} ${bx} ${by} Q ${bx + 16} ${by} ${bx + 16} ${by - 12} Q ${bx + 16} ${by - 24} ${bx + 6} ${by - 30} L ${bx + 6} ${by - 36} Z`)}
        {dot(bx, by - 39, 3.2)}
      </>);
    case 'boat': // gravy / sauce boat
    default:
      return (<>
        {fill(`M ${bx - 22} ${by - 16} Q ${bx} ${by + 3} ${bx + 20} ${by - 16} Z`)}
        {out(`M ${bx - 24} ${by - 18} L ${bx + 22} ${by - 18}`)}
        {out(`M ${bx - 24} ${by - 18} Q ${bx} ${by + 9} ${bx + 22} ${by - 18}`)}
        {out(`M ${bx + 22} ${by - 18} L ${bx + 33} ${by - 25}`)}
        {out(`M ${bx - 24} ${by - 17} q -9 1 -8 9 q 1 5 7 4`)}
        {out(`M ${bx - 9} ${by + 6} Q ${bx} ${by + 9} ${bx + 9} ${by + 6}`)}
      </>);
  }
}


/**
 * One family vessel as a standalone drawing (aria-hidden).
 * @param {{ familyName: string, color?: string, size?: number, testid?: string }} props
 */
export function SauceVessel({ familyName = '', color = CHALK_CREAM, size = 32, testid }) {
  return (
    <svg width={size} height={Math.round(size * 0.9)} viewBox="-8 2 80 72" aria-hidden="true" focusable="false"
      className="flex-shrink-0" data-testid={testid} data-vessel={sauceVesselFor(familyName)}>
      {vesselMark(sauceVesselFor(familyName), 32, 58, color, color, true)}
    </svg>
  );
}
