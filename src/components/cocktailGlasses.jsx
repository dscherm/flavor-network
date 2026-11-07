/**
 * cocktailGlasses.jsx — the cocktail family glasses (DESIGN-2).
 *
 * The glass geometry first drawn for the Cocktail Lab's family shelf
 * (CocktailBrowse), moved here so My bar and Invent a cocktail can draw the
 * same glass next to a drink. `glassMark` returns raw SVG elements centred
 * at `cx`, standing on y≈104; `CocktailFamilyGlass` wraps one in its own
 * <svg> for use inline in a list row or on a card.
 */
import { liftColor, drinkColor } from '../data/drinkColor.js';

// Each cocktail family gets a signature glass. Matched by name keyword;
// order matters (boozy/sipper before the generic stirred match).
export const GLASS_BY_FAMILY = [
  { rx: /tropical/i,            glass: 'pilsner' },  // tall vaso cervecero
  { rx: /highball|fizz/i,       glass: 'snifter' },  // brandy balloon
  { rx: /sour/i,                glass: 'margarita' },
  { rx: /boozy|sipper|rocks/i,  glass: 'rocks' },
  { rx: /aromatic|stir/i,       glass: 'martini' },
  { rx: /aperitivo|spritz/i,    glass: 'wine' },
];
export function glassTypeFor(name = '') {
  for (const { rx, glass } of GLASS_BY_FAMILY) if (rx.test(name)) return glass;
  return 'coupe';
}

/**
 * Render a chalk glass silhouette for a family, centered at `cx`, standing on
 * the shelf at y≈104. Returns SVG elements (liquid fill + chalk outline, plus
 * a stem/foot for stemware). Dashed stroke when inactive, solid when active.
 * `fillOpacity` overrides the liquid opacity (a poured drink reads fuller).
 */
export function glassMark(type, cx, color, stroke, active, fillOpacity) {
  const op = fillOpacity ?? (active ? 0.62 : 0.34);
  const liquid = (d) => <path d={d} fill={color} fillOpacity={op} stroke="none" data-part="liquid" />;
  const glass = (d) => (
    <path d={d} fill="none" stroke={stroke} strokeWidth={active ? 2.4 : 1.6}
      strokeDasharray={active ? '0' : '5 3'} strokeLinejoin="round" strokeLinecap="round" />
  );
  const stick = (x1, y1, x2, y2) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={active ? 2.4 : 1.6} strokeLinecap="round" />
  );
  switch (type) {
    case 'pilsner': // tall tapered beer/vaso-cervecero glass
      return (<>
        {liquid(`M ${cx - 9} 48 L ${cx + 9} 48 L ${cx + 6} 103 L ${cx - 6} 103 Z`)}
        {glass(`M ${cx - 11} 22 L ${cx + 11} 22 L ${cx + 6} 104 L ${cx - 6} 104 Z`)}
      </>);
    case 'snifter': // brandy balloon — round bowl, incurved rim, short stem
      return (<>
        {liquid(`M ${cx - 13} 66 Q ${cx - 14} 80 ${cx} 82 Q ${cx + 14} 80 ${cx + 13} 66 Q ${cx + 7} 72 ${cx} 72 Q ${cx - 7} 72 ${cx - 13} 66 Z`)}
        {glass(`M ${cx - 8} 48 Q ${cx - 19} 56 ${cx - 17} 72 Q ${cx - 15} 88 ${cx} 90 Q ${cx + 15} 88 ${cx + 17} 72 Q ${cx + 19} 56 ${cx + 8} 48`)}
        {stick(cx, 90, cx, 100)}{stick(cx - 11, 102, cx + 11, 102)}
      </>);
    case 'margarita': // wide flared bowl with a stepped waist, on a stem
      return (<>
        {liquid(`M ${cx - 15} 47 Q ${cx - 12} 55 ${cx} 57 Q ${cx + 12} 55 ${cx + 15} 47 Z`)}
        {glass(`M ${cx - 23} 40 Q ${cx - 20} 52 ${cx - 7} 58 L ${cx - 9} 63 Q ${cx - 9} 67 ${cx} 67 Q ${cx + 9} 67 ${cx + 9} 63 L ${cx + 7} 58 Q ${cx + 20} 52 ${cx + 23} 40`)}
        {stick(cx, 67, cx, 101)}{stick(cx - 14, 102, cx + 14, 102)}
      </>);
    case 'highball':
      return (<>
        {liquid(`M ${cx - 10} 56 L ${cx + 10} 56 L ${cx + 8.5} 103 L ${cx - 8.5} 103 Z`)}
        {glass(`M ${cx - 11} 28 L ${cx + 11} 28 L ${cx + 8.5} 104 L ${cx - 8.5} 104 Z`)}
      </>);
    case 'rocks':
      return (<>
        {liquid(`M ${cx - 14} 82 L ${cx + 14} 82 L ${cx + 13} 103 L ${cx - 13} 103 Z`)}
        {glass(`M ${cx - 15} 64 L ${cx + 15} 64 L ${cx + 13} 104 L ${cx - 13} 104 Z`)}
      </>);
    case 'martini':
      return (<>
        {liquid(`M ${cx - 12} 46 L ${cx + 12} 46 L ${cx} 63 Z`)}
        {glass(`M ${cx - 22} 38 L ${cx + 22} 38 L ${cx} 74 Z`)}
        {stick(cx, 74, cx, 101)}{stick(cx - 13, 102, cx + 13, 102)}
      </>);
    case 'coupe':
      return (<>
        {liquid(`M ${cx - 13} 47 Q ${cx} 60 ${cx + 13} 47 Z`)}
        {glass(`M ${cx - 20} 43 L ${cx + 20} 43 Q ${cx} 71 ${cx - 20} 43 Z`)}
        {stick(cx, 65, cx, 101)}{stick(cx - 13, 102, cx + 13, 102)}
      </>);
    case 'wine':
      return (<>
        {liquid(`M ${cx - 10} 50 Q ${cx - 10} 62 ${cx} 64 Q ${cx + 10} 62 ${cx + 10} 50 Z`)}
        {glass(`M ${cx - 13} 38 Q ${cx - 15} 62 ${cx} 66 Q ${cx + 15} 62 ${cx + 13} 38 Z`)}
        {stick(cx, 66, cx, 101)}{stick(cx - 12, 102, cx + 12, 102)}
      </>);
    case 'hurricane':
    default:
      return (<>
        {liquid(`M ${cx - 9.5} 60 Q ${cx - 11} 84 ${cx - 6} 103 L ${cx + 6} 103 Q ${cx + 11} 84 ${cx + 9.5} 60 Q ${cx} 64 ${cx - 9.5} 60 Z`)}
        {glass(`M ${cx - 11} 32 Q ${cx - 16} 56 ${cx - 9} 76 Q ${cx - 12} 95 ${cx - 6} 104 L ${cx + 6} 104 Q ${cx + 12} 95 ${cx + 9} 76 Q ${cx + 16} 56 ${cx + 11} 32 Z`)}
      </>);
  }
}

/**
 * One cocktail family glass as a standalone drawing. `color` is the family
 * colour (outline + glow; dark families are lifted so the line reads on the
 * board); `liquid` is the drink inside (defaults to the family colour).
 * Decorative: aria-hidden — the drink's name stays as text beside it.
 */
export function CocktailFamilyGlass({ familyName = '', color = '#9a8f7a', liquid, size = 40, testid = 'cocktail-glass' }) {
  const type = glassTypeFor(familyName);
  const line = liftColor(color);
  return (
    <svg
      width={(size * 52) / 92} height={size} viewBox="0 14 52 94"
      aria-hidden="true" focusable="false" data-testid={testid} data-glass={type}
      style={{ flexShrink: 0, overflow: 'visible', filter: `drop-shadow(0 0 3px ${line}55)` }}
    >
      {glassMark(type, 26, liquid || color, line, true, liquid ? 0.85 : undefined)}
    </svg>
  );
}

/**
 * A cocktail's family glass, filled with a colour from its ingredients
 * (`ingredients_raw` lines, or plain names). Renders nothing when the
 * cocktail's family is unknown.
 */
export function DrinkGlass({ cocktail, familyById, size = 40 }) {
  const fam = familyById?.get(cocktail?.family_id);
  if (!fam) return null;
  const names = (cocktail.ingredients_raw || cocktail.ingredients || [])
    .map((i) => (typeof i === 'string' ? i : i?.raw || i?.name || ''));
  const { color } = drinkColor(names, fam.color);
  return <CocktailFamilyGlass familyName={fam.name} color={fam.color} liquid={color} size={size} testid="drink-glass" />;
}
