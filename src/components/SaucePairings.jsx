/**
 * SaucePairings — the sauce card's "Serve it with" and "Wines" sections.
 *
 *   Serve it with  the proteins the sauce is classically served with
 *                  (hand-written `proteins` in sauce_augment.json), each
 *                  with its small chalk drawing.
 *   Wines          the Wine Lab engine's best wine for the sauce on each of
 *                  those proteins, grouped ("Syrah — with beef, lamb"), each
 *                  with its family glass; "More wines" opens the full list
 *                  in the Wine Lab for the first protein.
 *
 * Wine data loads lazily; while it loads (or if it fails) the proteins
 * still render and the wine section is simply absent.
 */
import { useEffect, useMemo, useState } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB } from '../data/chalkTheme.js';
import { loadWineStyles, familyColor } from '../data/wineStyles.js';
import { winesForSauce, proteinIngredient } from '../data/sauceWines.js';
import { WineGlass } from './wineGlasses.jsx';
import { IngredientArt } from './chalkArt.jsx';

const SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

function Label({ children }) {
  return (
    <div className="uppercase tracking-[0.16em] mb-1.5 mt-3"
      style={{ color: CHALK_DIM, fontFamily: FONT, fontSize: 'clamp(13px, 1.7vh, 18px)', textShadow: SHADOW }}>
      {children}
    </div>
  );
}

export default function SaucePairings({ sauce, color = '#fb923c', categoryOf = null, onFindWine = null }) {
  const [styles, setStyles] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadWineStyles(import.meta.env.BASE_URL).then((d) => { if (!cancelled && d) setStyles(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const proteins = sauce?.proteins || [];
  const ingredients = useMemo(
    () => (sauce?.ingredients || []).map((i) => (typeof i === 'string' ? i : i?.name)).filter(Boolean),
    [sauce],
  );
  const wines = useMemo(() => (styles
    ? winesForSauce({ ...sauce, ingredients }, styles.wines, { categoryOf: categoryOf || undefined })
    : []), [styles, sauce, ingredients, categoryOf]);

  if (!proteins.length) return null;
  const first = proteins[0];

  return (
    <div data-testid="sauce-pairings">
      <Label>Serve it with</Label>
      <ul className="flex flex-wrap gap-1.5" data-testid="sauce-proteins">
        {proteins.map((p) => (
          <li key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
            style={{ borderColor: `${color}77`, background: `${color}1a`, color: CHALK_CREAM, fontFamily: FONT, fontSize: 18 }}>
            <IngredientArt category="protein" name={proteinIngredient(p)} size={18} ink={CHALK_CREAM} />
            {p}
          </li>
        ))}
      </ul>

      {wines.length > 0 && (
        <>
          <Label>Wines</Label>
          <ul className="flex flex-col gap-2" data-testid="sauce-wines">
            {wines.map(({ wine, proteins: ps, reason }) => (
              <li key={wine.id} className="flex items-center gap-2.5" data-testid={`sauce-wine-${wine.id}`}>
                <WineGlass family={wine.family} color={familyColor(styles.families, wine.family)} size={40} />
                <div className="min-w-0">
                  <div style={{ fontFamily: FONT, fontSize: 19, color: CHALK_CREAM, lineHeight: 1.2, textShadow: SHADOW }}>
                    {wine.name}
                  </div>
                  <div className="text-[12px]" style={{ color: CHALK_SUB }}>
                    with {ps.join(', ')}{reason ? ` · ${reason}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {onFindWine && (
            <button
              type="button"
              data-testid="sauce-more-wines"
              onClick={() => onFindWine([...ingredients, proteinIngredient(first)], `${sauce.name} with ${first}`, 'sauce', { cuisine: sauce.cuisine })}
              className="mt-2 min-h-[44px] px-3 rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: `${color}88`, color: CHALK_CREAM, fontFamily: FONT, fontSize: 18, outlineColor: CHALK_CREAM }}
            >
              🍷 More wines for {sauce.name} with {first} →
            </button>
          )}
        </>
      )}
    </div>
  );
}
