/**
 * pictureArt.jsx — the drawings a cook can pick as a recipe's picture (PICTURE-2).
 *
 * One registry with STABLE ids, because a saved or shared recipe stores the id:
 *   dish:<kind>      the DishArt kinds (all stay pickable even when no recipe type reaches them)
 *   glass:<name>     coupe, rocks, highball, flute, martini, mug   (take the drink colour)
 *   sauce:<name>     pan, jar, bowl, bottle                        (take the sauce colour)
 * Never rename or reuse an id; add new ones. PictureArt draws any id and draws a neutral
 * dashed ring for one it does not know, so an old or foreign id can never crash a page.
 */
import { DishArt, DISH_ART_KINDS, Chalk } from './chalkArt.jsx';
import { glassMark } from './cocktailGlasses.jsx';
import { CHALK_CREAM, CHALK_DIM, CHALK_SUB } from '../data/chalkTheme.js';

export const PICTURE_KINDS = ['dish', 'cocktail', 'sauce'];

const GLASS_NAMES = ['coupe', 'rocks', 'highball', 'flute', 'martini', 'mug'];
const SAUCE_NAMES = ['pan', 'jar', 'bowl', 'bottle'];
const GLASS_LABEL = { coupe: 'Coupe', rocks: 'Rocks glass', highball: 'Highball', flute: 'Flute', martini: 'Martini glass', mug: 'Mug' };
const SAUCE_LABEL = { pan: 'Saucepan', jar: 'Jar', bowl: 'Bowl', bottle: 'Bottle' };
const DISH_LABEL = { wok: 'Stir-fry (wok)', veg: 'Vegetables', bake: 'Bake', taco: 'Taco', plate: 'Plate' };

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const BY_KIND = {
  dish: DISH_ART_KINDS.map((k) => ({ id: `dish:${k}`, label: DISH_LABEL[k] || titleCase(k) })),
  cocktail: GLASS_NAMES.map((k) => ({ id: `glass:${k}`, label: GLASS_LABEL[k] })),
  sauce: SAUCE_NAMES.map((k) => ({ id: `sauce:${k}`, label: SAUCE_LABEL[k] })),
};

/** The pickable drawings for a recipe kind: [{ id, label }]. Unknown kind: dishes. */
export function picturesFor(kind) {
  return BY_KIND[kind] || BY_KIND.dish;
}

/** Every pickable id. */
export function allPictureIds() {
  return PICTURE_KINDS.flatMap((k) => BY_KIND[k].map((p) => p.id));
}

/** Human name for an id, or null if the id is unknown. */
export function pictureLabel(id) {
  for (const k of PICTURE_KINDS) {
    const hit = BY_KIND[k].find((p) => p.id === id);
    if (hit) return hit.label;
  }
  return null;
}

/** True for an id the registry draws. */
export function isPictureId(id) {
  return pictureLabel(id) !== null;
}

// ── Glasses ───────────────────────────────────────────────────────────
// coupe, rocks, highball and martini reuse glassMark (the Cocktail Lab's own glasses);
// flute and mug are drawn here with the same line weight, so the set reads as one.
function flute(cx, color, stroke, op) {
  const line = (d) => <path d={d} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />;
  const stick = (x1, y1, x2, y2) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />;
  return (<>
    <path d={`M ${cx - 7.3} 42 Q ${cx - 8} 62 ${cx} 68 Q ${cx + 8} 62 ${cx + 7.3} 42 Z`} fill={color} fillOpacity={op} stroke="none" data-part="liquid" />
    {line(`M ${cx - 8} 26 Q ${cx - 9} 62 ${cx} 70 Q ${cx + 9} 62 ${cx + 8} 26 Z`)}
    <circle cx={cx - 2} cy="56" r="1.2" fill={stroke} fillOpacity="0.8" />
    <circle cx={cx + 2.5} cy="48" r="1" fill={stroke} fillOpacity="0.8" />
    {stick(cx, 70, cx, 101)}{stick(cx - 12, 102, cx + 12, 102)}
  </>);
}
function mug(cx, color, stroke, op) {
  const line = (d) => <path d={d} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />;
  return (<>
    <path d={`M ${cx - 12.5} 56 L ${cx + 12.5} 56 L ${cx + 12.5} 101 Q ${cx + 12.5} 103 ${cx + 10.5} 103 L ${cx - 10.5} 103 Q ${cx - 12.5} 103 ${cx - 12.5} 101 Z`} fill={color} fillOpacity={op} stroke="none" data-part="liquid" />
    {line(`M ${cx - 14} 44 L ${cx + 14} 44 L ${cx + 14} 100 Q ${cx + 14} 104 ${cx + 10} 104 L ${cx - 10} 104 Q ${cx - 14} 104 ${cx - 14} 100 Z`)}
    {line(`M ${cx + 14} 54 Q ${cx + 29} 54 ${cx + 29} 72 Q ${cx + 29} 90 ${cx + 14} 92`)}
  </>);
}

function GlassPicture({ name, size, color }) {
  const cx = 26;
  const body = name === 'flute' ? flute(cx, color, CHALK_CREAM, 0.7)
    : name === 'mug' ? mug(cx, color, CHALK_CREAM, 0.7)
      : glassMark(name, cx, color, CHALK_CREAM, true, 0.7);
  return (
    <svg
      width={size} height={size} viewBox="-21 14 94 94" aria-hidden="true" focusable="false"
      data-testid="picture-art" data-picture={`glass:${name}`}
      style={{ flexShrink: 0, overflow: 'visible', filter: 'drop-shadow(0 0 2px rgba(245,239,222,0.35))' }}
    >
      {body}
    </svg>
  );
}

// ── Sauce drawings (viewBox 0 0 100 100, same Chalk helper as chalkArt) ──
const SAUCE_DRAW = {
  pan: (c) => (
    <>
      <path d="M22 50 L78 50 L75 82 Q74 88 68 88 L32 88 Q26 88 25 82 Z" fill={c} fillOpacity="0.7" />
      <Chalk d="M18 44 L82 44 L77 84 Q76 90 69 90 L31 90 Q24 90 23 84 Z" c={CHALK_CREAM} />
      <Chalk d="M82 50 L97 46" c={CHALK_CREAM} w={3.2} />
      <Chalk d="M36 34 Q30 26 36 18 Q42 10 36 4" c={CHALK_CREAM} w={2} />
      <Chalk d="M52 36 Q46 28 52 20 Q58 12 52 6" c={CHALK_CREAM} w={2} />
      <Chalk d="M8 94 L92 94" c={CHALK_SUB} w={2} />
    </>
  ),
  jar: (c) => (
    <>
      <path d="M26 38 L74 38 L74 84 Q74 88 70 88 L30 88 Q26 88 26 84 Z" fill={c} fillOpacity="0.7" />
      <Chalk d="M24 28 L76 28 L76 38 Q80 44 80 52 L80 86 Q80 92 74 92 L26 92 Q20 92 20 86 L20 52 Q20 44 24 38 Z" c={CHALK_CREAM} />
      <Chalk d="M22 16 L78 16 L78 28 L22 28 Z" c={CHALK_CREAM} fill={CHALK_CREAM} fillOpacity={0.12} />
      <Chalk d="M30 20 L30 24 M40 20 L40 24 M50 20 L50 24 M60 20 L60 24 M70 20 L70 24" c={CHALK_DIM} w={1.4} />
      <rect x="32" y="54" width="36" height="22" rx="2" fill={CHALK_CREAM} fillOpacity="0.16" />
      <Chalk d="M38 62 L62 62 M40 69 L58 69" c={CHALK_DIM} w={1.6} />
    </>
  ),
  bowl: (c) => (
    <>
      <path d="M16 52 L84 52 Q82 76 50 80 Q18 76 16 52 Z" fill={c} fillOpacity="0.7" />
      <Chalk d="M10 46 L90 46 Q88 84 50 88 Q12 84 10 46 Z" c={CHALK_CREAM} />
      <Chalk d="M10 46 Q50 56 90 46" c={CHALK_CREAM} w={1.8} />
      <Chalk d="M38 88 L36 94 L64 94 L62 88" c={CHALK_CREAM} w={2.2} />
      <Chalk d="M56 50 L80 10" c={CHALK_DIM} w={2.8} />
      <Chalk d="M74 10 Q82 6 86 14 Q82 20 76 16" c={CHALK_DIM} w={2.2} />
    </>
  ),
  bottle: (c) => (
    <>
      <path d="M32 54 L68 54 L68 84 Q68 88 64 88 L36 88 Q32 88 32 84 Z" fill={c} fillOpacity="0.7" />
      <Chalk d="M42 12 L58 12 L58 32 Q70 38 70 52 L70 86 Q70 92 64 92 L36 92 Q30 92 30 86 L30 52 Q30 38 42 32 Z" c={CHALK_CREAM} />
      <Chalk d="M44 6 L56 6 L56 12 L44 12 Z" c={CHALK_CREAM} fill={CHALK_CREAM} fillOpacity={0.2} w={2.2} />
      <rect x="36" y="58" width="28" height="20" rx="2" fill={CHALK_CREAM} fillOpacity="0.16" />
      <Chalk d="M41 65 L59 65 M43 72 L57 72" c={CHALK_DIM} w={1.6} />
    </>
  ),
};

function SaucePicture({ name, size, color }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false"
      data-testid="picture-art" data-picture={`sauce:${name}`}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      {SAUCE_DRAW[name](color)}
    </svg>
  );
}

function FallbackPicture({ size }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false"
      data-testid="picture-art" data-picture="fallback"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <circle cx="50" cy="50" r="34" fill="none" stroke={CHALK_SUB} strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="18" fill="none" stroke={CHALK_SUB} strokeWidth="1.6" strokeDasharray="4 4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Draw a picture by id. `color` tints the drink (glasses), the sauce (sauce drawings) or the
 * food (dishes). Unknown, missing or malformed ids draw a neutral ring; this never throws.
 */
export function PictureArt({ id, size = 64, color }) {
  if (typeof id === 'string') {
    const [group, name] = id.split(':');
    if (group === 'glass' && GLASS_NAMES.includes(name)) {
      return <GlassPicture name={name} size={size} color={color || '#7dd3fc'} />;
    }
    if (group === 'sauce' && SAUCE_NAMES.includes(name)) {
      return <SaucePicture name={name} size={size} color={color || '#b91c1c'} />;
    }
    if (group === 'dish' && DISH_ART_KINDS.includes(name)) {
      return <DishArt kind={name} size={size} accent={color || CHALK_CREAM} />;
    }
  }
  return <FallbackPicture size={size} />;
}
