/**
 * InventCocktail — "Invent a cocktail" for the Cocktail Lab.
 *
 * Pick a spirit, then what you are going for (a codex family). The panel
 * seeds that family's skeleton (src/data/cocktailInvent.js cocktailSkeleton +
 * src/data/inventBuild.js): required slots are pre-filled with the best-
 * pairing pick from the bar (or the whole codex with an empty bar), optional
 * slots start empty. The user swaps any slot from a ranked shortlist or by
 * typing, and adds extras. Amounts, glass colour, "why" and the closest
 * existing cocktails all re-run on every change. No shuffle.
 *
 * `seed` = { familyId?, base?, pinned?: [{ key, source: 'search' }] } opens
 * the panel on a baseline with search pins locked into the slots they fit.
 */
import { useMemo, useState } from 'react';
import {
  cocktailSkeleton, rankCocktailSlot, drinkFromBuild, drinkRows, drinkAsCocktail, isBaseSpirit, FAMILY_SKELETONS, FAMILY_BLURB,
} from '../data/cocktailInvent.js';
import { seedBuild, fillRequired, shortlist, setSlot, clearSlot, addExtra, removeExtra, missing } from '../data/inventBuild.js';
import { nearestCocktails } from '../data/cocktailRiff.js';
import { barKey } from '../data/myBar.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { CocktailFamilyGlass, DrinkGlass } from './cocktailGlasses.jsx';
import { drinkColor } from '../data/drinkColor.js';
import InventSlots from './InventSlots.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
// Display order: the two most familiar styles first.
export const INVENT_FAMILY_ORDER = [2, 4, 1, 5, 0, 3];
const NEUTRAL = '#9a8f7a';
const NO_PINS = [];
const withArticle = (label) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;

export default function InventCocktail({
  bar = [],
  cocktails = [],
  families = [],
  roles = {},
  pool = null,
  pairingIndex = null,
  initialFamily = 2,
  seed = null,
  onClose,
  onRiff,
  onOpenRecipeLab,
  onSelectCocktail,
}) {
  const names = pairingIndex?.names || new Set();
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const searchPins = seed?.pinned || NO_PINS;

  const rank = (slot, currentKeys) => rankCocktailSlot({ slot, currentKeys, bar, pool, roles, pairingIndex });
  // Auto-fill draws on the bar when there is one; the shortlist also offers the rest of the codex.
  const fillRank = (slot, currentKeys) => rank(slot, currentKeys).filter((c) => c.have || !bar.length);

  // Seed + fill for a (family, spirit). A family with no base-spirit slot ignores the spirit.
  const seedFor = (fid, base) => {
    const skel = cocktailSkeleton(fid, { roles });
    const hasBase = skel.slots.some((s) => s.base);
    const pinned = [
      ...(hasBase && base ? [{ key: base, source: 'user' }] : []),
      ...searchPins.filter((p) => p.key !== base).map((p) => ({ key: p.key, source: 'search' })),
    ];
    return fillRequired(seedBuild(skel, { lab: 'cocktail', baseline: { familyId: fid, base }, pinned }), fillRank);
  };

  const [state, setState] = useState(() => {
    const familyId = FAMILY_SKELETONS[seed?.familyId] ? seed.familyId : initialFamily;
    const base = seed?.base || null;
    return { familyId, base, build: seedFor(familyId, base) };
  });
  const [notice, setNotice] = useState(() => (state.build.rejected.length ? state.build.rejected.map((r) => r.reason).join(' ') : null));
  const { familyId, base, build } = state;

  const reseed = (fid, b) => {
    const next = seedFor(fid, b);
    setState({ familyId: fid, base: b, build: next });
    setNotice(next.rejected.length ? next.rejected.map((r) => r.reason).join(' ') : null);
  };
  const update = (res) => {
    if (res.ok) { setState((st) => ({ ...st, build: res.build })); setNotice(null); } else setNotice(res.reason);
    return res.ok;
  };

  const skel = FAMILY_SKELETONS[familyId];
  const hasBase = skel.slots.some((s) => s.base);
  const familyName = familyById.get(familyId)?.name || skel.name;
  const color = familyById.get(familyId)?.color || NEUTRAL;

  // Base spirits on offer: the bar's, or the codex's most common (plus a spirit that came in on the seed).
  const baseOptions = useMemo(() => {
    let list = [];
    if (bar.length) list = bar.filter((k) => isBaseSpirit(k, roles));
    else {
      const spirits = pool?.get('spirit');
      list = spirits ? [...spirits].filter(([k]) => isBaseSpirit(k, roles)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k) : [];
    }
    return base && !list.includes(base) ? [base, ...list] : list;
  }, [bar, pool, roles, base]);

  const drink = useMemo(
    () => drinkFromBuild(build, { familyId, familyName, roles, pairingIndex }),
    [build, familyId, familyName, roles, pairingIndex],
  );
  const pour = useMemo(() => drinkColor(drink.lines.map((l) => l.key), color), [drink, color]);
  const nearest = useMemo(
    () => (drink.lines.length ? nearestCocktails(drinkRows(drink), cocktails, names, { k: 3 }) : []),
    [drink, cocktails, names],
  );
  const amounts = useMemo(() => new Map(drink.lines.map((l) => [l.key, l.amount])), [drink]);
  const needs = missing(build);

  const keyFor = (text) => barKey(text, names) || String(text).trim().toLowerCase();
  const onPick = (slotId, value) => update(setSlot(build, slotId, keyFor(value), { have: bar.includes(keyFor(value)) }));
  const onAddExtra = (text) => update(addExtra(build, keyFor(text)));
  const shortlistFor = (slotId) => shortlist(build, slotId, rank, 8)
    .map((c) => ({ key: c.key, have: !!c.have, note: bar.length && !c.have ? 'not in your bar' : undefined }));

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

        <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>1 · Spirit</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Spirit" data-testid="invent-bases">
          <button type="button" aria-pressed={base == null} onClick={() => reseed(familyId, null)}
            className="px-3 py-1 rounded-full border min-h-[44px] text-[18px]" style={chip(base == null)}>any</button>
          {baseOptions.map((k) => (
            <button key={k} type="button" aria-pressed={base === k} onClick={() => reseed(familyId, k)}
              className="px-3 py-1 rounded-full border min-h-[44px] text-[18px]" style={chip(base === k)}>{k}</button>
          ))}
        </div>

        <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>2 · What are you going for?</p>
        <div className="flex flex-col gap-1.5" role="group" aria-label="What are you going for?" data-testid="invent-families">
          {INVENT_FAMILY_ORDER.map((id) => {
            const name = familyById.get(id)?.name || FAMILY_SKELETONS[id].name;
            return (
              <button key={id} type="button" aria-label={name} aria-pressed={familyId === id} onClick={() => reseed(id, base)}
                className="pl-2 pr-3 py-1 rounded-xl border min-h-[48px] inline-flex items-center gap-2 text-left" style={chip(familyId === id)}>
                <CocktailFamilyGlass familyName={name} color={familyById.get(id)?.color || NEUTRAL}
                  liquid={familyById.get(id)?.color || NEUTRAL} size={30} testid={`invent-family-glass-${id}`} />
                <span className="min-w-0">
                  <span className="block text-[19px] leading-tight">{name}</span>
                  <span className="block text-[12px] leading-tight" style={{ fontFamily: SANS, opacity: 0.75 }} data-testid={`invent-blurb-${id}`}>
                    {FAMILY_BLURB[id]} · {FAMILY_SKELETONS[id].glass.split(' or ')[0]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {!hasBase && base && (
          <p className="mt-2 text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="invent-no-spirit">
            No spirit in this style — the aperitif is the base, so {base} isn't used. Add it below as an extra if you want it anyway.
          </p>
        )}

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

          {needs.length > 0 && (
            <p className="mb-2 text-[15px] rounded-lg px-3 py-2" style={{ fontFamily: SANS, color: CHALK_CREAM, border: `1px dashed ${CHALK_RAIL}` }} data-testid="invent-missing">
              Needs {needs.map(withArticle).join(' and ')}.
            </p>
          )}

          <InventSlots build={build} color={color} testidPrefix="invent" notice={notice}
            shortlistFor={shortlistFor} amountFor={(k) => amounts.get(k)}
            onPick={onPick} onAddExtra={onAddExtra}
            onClear={(slotId) => { setState((st) => ({ ...st, build: clearSlot(st.build, slotId) })); setNotice(null); }}
            onRemoveExtra={(k) => { setState((st) => ({ ...st, build: removeExtra(st.build, k) })); setNotice(null); }} />

          <p className="mt-3 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="invent-why">{drink.why}</p>
          <p className="mt-1 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>Amounts are house proportions for the style, not a tested recipe — taste and adjust.</p>

          {nearest.length > 0 && (
            <div className="mt-3" data-testid="invent-nearest">
              <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Closest existing cocktails</p>
              {nearest.map((x) => (
                <button key={x.cocktail.name} type="button" onClick={() => onSelectCocktail?.(x.cocktail.name)}
                  className="w-full text-left flex items-center gap-2 py-0.5 min-h-[44px]">
                  <DrinkGlass cocktail={x.cocktail} familyById={familyById} size={32} />
                  <span className="text-[19px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{x.cocktail.name}</span>
                  <span className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{Math.round(x.similarity * 100)}% alike</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => reseed(familyId, base)} data-testid="invent-restart"
              className="px-3 py-2 rounded-lg border min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM }}>
              Start over
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
      </div>
    </div>
  );
}
