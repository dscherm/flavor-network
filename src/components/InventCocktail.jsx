/**
 * InventCocktail — "Invent a cocktail" for the Cocktail Lab.
 *
 * Pick a style (codex family) and optionally a base spirit; the panel
 * fills the family's skeleton from the user's bar (or, with an empty bar,
 * from every bottle in the codex), choosing the combination that pairs
 * best in real recipes (src/data/cocktailInvent.js). The result is a card
 * with amounts, roles, build and glass, a "why it works" line, and the
 * closest existing cocktails. Shuffle steps to the next-best combination.
 */
import { useEffect, useMemo, useState } from 'react';
import { FAMILY_SKELETONS, inventCocktails, isBaseSpirit, drinkRows, drinkAsCocktail } from '../data/cocktailInvent.js';
import { nearestCocktails } from '../data/cocktailRiff.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { CocktailFamilyGlass, DrinkGlass } from './cocktailGlasses.jsx';
import { drinkColor } from '../data/drinkColor.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
// Display order: the two most familiar styles first.
export const INVENT_FAMILY_ORDER = [2, 4, 1, 5, 0, 3];
const NEUTRAL = '#9a8f7a';

export default function InventCocktail({
  bar = [],
  cocktails = [],
  families = [],
  roles = {},
  pool = null,
  pairingIndex = null,
  initialFamily = 2,
  onClose,
  onRiff,
  onOpenRecipeLab,
  onSelectCocktail,
}) {
  const names = pairingIndex?.names || new Set();
  const [familyId, setFamilyId] = useState(initialFamily);
  const [base, setBase] = useState(null);
  const [n, setN] = useState(0);
  const skel = FAMILY_SKELETONS[familyId];
  const hasBase = skel.slots.some((s) => s.base);
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const color = familyById.get(familyId)?.color || NEUTRAL;

  // Base spirits on offer: the bar's, or the codex's most common.
  const baseOptions = useMemo(() => {
    if (bar.length) return bar.filter((k) => isBaseSpirit(k, roles));
    const spirits = pool?.get('spirit');
    return spirits ? [...spirits].filter(([k]) => isBaseSpirit(k, roles)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k) : [];
  }, [bar, pool, roles]);
  useEffect(() => { if (base && !baseOptions.includes(base)) setBase(null); }, [base, baseOptions]);

  const result = useMemo(
    () => inventCocktails({ familyId, base: hasBase ? base : null, bar, pool, roles, pairingIndex, limit: 12 }),
    [familyId, base, hasBase, bar, pool, roles, pairingIndex],
  );
  useEffect(() => { setN(0); }, [familyId, base, bar]);
  const drink = result.ok ? result.drinks[n % result.drinks.length] : null;
  // The invented drink's colour: the family colour unless an ingredient
  // (campari, grenadine, blue curaçao …) tints it.
  const pour = useMemo(() => (drink ? drinkColor(drink.lines.map((l) => l.key), color) : null), [drink, color]);
  const familyName = familyById.get(familyId)?.name || skel.name;
  const nearest = useMemo(
    () => (drink ? nearestCocktails(drinkRows(drink), cocktails, names, { k: 3 }) : []),
    [drink, cocktails, names],
  );

  const chip = (active) => ({
    fontFamily: FONT,
    color: active ? '#0a0a0a' : CHALK_CREAM,
    background: active ? CHALK_CREAM : 'transparent',
    borderColor: CHALK_RAIL,
  });

  return (
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="invent-cocktail" role="dialog" aria-label="Invent a cocktail">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2">
        <button type="button" onClick={onClose} data-testid="invent-close"
          className="px-3 py-2 rounded-lg min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}>
          ← Back
        </button>
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>Invent a cocktail</h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="invent-source">
          {bar.length
            ? `From your bar (${bar.length} item${bar.length === 1 ? '' : 's'}).`
            : 'Your bar is empty, so this draws on every bottle in the cocktail list.'}
        </p>

        <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Style</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Style" data-testid="invent-families">
          {INVENT_FAMILY_ORDER.map((id) => (
            <button key={id} type="button" aria-pressed={familyId === id} onClick={() => setFamilyId(id)}
              className="pl-1.5 pr-3 py-0.5 rounded-full border min-h-[40px] text-[16px] inline-flex items-center gap-1" style={chip(familyId === id)}>
              <CocktailFamilyGlass familyName={familyById.get(id)?.name || FAMILY_SKELETONS[id].name}
                color={familyById.get(id)?.color || NEUTRAL}
                liquid={familyById.get(id)?.color || NEUTRAL} size={30} testid={`invent-family-glass-${id}`} />
              {familyById.get(id)?.name || FAMILY_SKELETONS[id].name}
            </button>
          ))}
        </div>

        {hasBase && baseOptions.length > 0 && (
          <>
            <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Base spirit</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Base spirit" data-testid="invent-bases">
              <button type="button" aria-pressed={base == null} onClick={() => setBase(null)}
                className="px-3 py-1 rounded-full border min-h-[36px] text-[16px]" style={chip(base == null)}>any</button>
              {baseOptions.map((k) => (
                <button key={k} type="button" aria-pressed={base === k} onClick={() => setBase(k)}
                  className="px-3 py-1 rounded-full border min-h-[36px] text-[16px]" style={chip(base === k)}>{k}</button>
              ))}
            </div>
          </>
        )}

        {!result.ok && (
          <div className="mt-4 rounded-lg px-3 py-3" style={{ border: `1px dashed ${CHALK_RAIL}` }} data-testid="invent-missing">
            <p className="text-[20px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>
              Can't build a {skel.name.toLowerCase()} drink from this bar yet.
            </p>
            <p className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
              {result.missing.length ? `Missing: ${result.missing.join(', ')}.` : result.reason}
            </p>
          </div>
        )}

        {drink && (
          <article className="mt-4 rounded-xl px-4 py-3" style={{ border: `1px solid ${color}aa`, background: `${color}1a` }} data-testid="invent-card">
            <div className="flex items-center gap-3 mb-2">
              <span data-testid="invent-glass" data-color={pour.color} data-tinted={pour.tinted ? 'true' : 'false'} className="flex-shrink-0">
                <CocktailFamilyGlass familyName={familyName} color={color} liquid={pour.color} size={92} testid="invent-drink-glass" />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-[30px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }} data-testid="invent-name">{drink.name}</h3>
                <p className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{drink.family} · {drink.build} · {drink.glass}</p>
              </div>
            </div>
            <ul className="flex flex-col gap-1" data-testid="invent-lines">
              {drink.lines.map((l) => (
                <li key={l.key} className="flex items-baseline gap-2">
                  <span className="text-[13px] w-16 flex-shrink-0 text-right" style={{ fontFamily: SANS, color: CHALK_DIM }}>{l.amount}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[20px] truncate" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{l.key}</span>
                    <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{l.label}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="invent-why">{drink.why}</p>
            <p className="mt-1 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>Amounts are house proportions for the style, not a tested recipe — taste and adjust.</p>

            {nearest.length > 0 && (
              <div className="mt-3" data-testid="invent-nearest">
                <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Closest existing cocktails</p>
                {nearest.map((x) => (
                  <button key={x.cocktail.name} type="button" onClick={() => onSelectCocktail?.(x.cocktail.name)}
                    className="w-full text-left flex items-center gap-2 py-0.5 min-h-[36px]">
                    <DrinkGlass cocktail={x.cocktail} familyById={familyById} size={32} />
                    <span className="text-[19px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{x.cocktail.name}</span>
                    <span className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{Math.round(x.similarity * 100)}% alike</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setN((i) => i + 1)} disabled={result.drinks.length < 2} data-testid="invent-shuffle"
                className="px-3 py-2 rounded-lg border min-h-[44px] disabled:opacity-40" style={{ fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM }}>
                🔀 Shuffle
              </button>
              {onRiff && (
                <button type="button" onClick={() => onRiff(drinkAsCocktail(drink))} data-testid="invent-riff"
                  className="px-3 py-2 rounded-lg border min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM }}>
                  Riff on it
                </button>
              )}
              {onOpenRecipeLab && (
                <button type="button" onClick={() => onOpenRecipeLab(drink.lines.map((l) => l.key))} data-testid="invent-notebook"
                  className="px-3 py-2 rounded-lg min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, color: '#0a0a0a', background: CHALK_CREAM }}>
                  Write it in the Recipe Notebook →
                </button>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
