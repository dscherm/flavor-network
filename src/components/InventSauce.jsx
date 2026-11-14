/**
 * InventSauce — "Invent a sauce" for the Sauce Lab. The sauce counterpart
 * of InventCocktail: pick a baseline, then build it yourself.
 *
 * Pick a technique (one of the INVENT_STYLES skeletons: roux, emulsion,
 * reduction, tomato, curry base, …) and optionally a protein to serve it
 * with. The panel seeds that style's skeleton (src/data/inventSauce.js
 * sauceSkeleton + src/data/inventBuild.js): each REQUIRED slot is pre-filled
 * with the best-pairing pick, pantry first (marked "you'd need" when it comes
 * from outside the pantry); optional slots start empty. The user swaps any
 * slot from a ranked shortlist or by typing, and adds extras. Amounts, the
 * method, the "why", the wine (with a protein) and the closest existing
 * sauce all re-run on every change. No shuffle, no three-up page.
 *
 * "Only what I have" restricts the shortlists and the pre-fill to the pantry:
 * a required slot the pantry cannot fill is reported as missing, never filled
 * from outside (no hollandaise without egg yolk).
 *
 * `seed` = { styleId?, protein?, pinned?: [{ key, source: 'search' }] } opens
 * the panel on a baseline with search pins locked into the slots they fit.
 * Pins survive technique / protein / pantry changes and Start over.
 *
 * Test ids: the panel keeps sauce-invent, -close, -source, -styles,
 * -chemistry, -proteins, -pantry-only, -card, -vessel, -name, -missing (the
 * "Needs …" line), -shopping, -method, -why, -honest, -wine, -nearest,
 * -notebook, -restart. The slot list is InventSlots with testidPrefix
 * "sauce-invent-slots": sauce-invent-slots-slot-{id} / -line-{id} /
 * -amount-{id} / -open-{id} / -shortlist-{id} / -option / -type-{id} /
 * -use-{id} / -clear-{id} / -extras / -extra / -remove-{key} / -add-input /
 * -add / -notice / -need (the "you'd need" mark on a non-pantry pick).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  INVENT_STYLES, INVENT_STYLE_BY_ID, sauceSkeleton, rankSauceSlot, sauceFromBuild, haveSauceKey, buildSaucePool, proteinVocabulary,
} from '../data/inventSauce.js';
import { seedBuild, fillRequired, shortlist, setSlot, clearSlot, addExtra, removeExtra, missing } from '../data/inventBuild.js';
import { kitchenKey } from '../data/myKitchen.js';
import { nearestSauces } from '../data/sauceSimilarity.js';
import { winesForSauce, proteinIngredient } from '../data/sauceWines.js';
import { loadWineStyles, familyColor } from '../data/wineStyles.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, CARD_INK, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { SauceVessel } from './sauceVessels.jsx';
import { WineGlass } from './wineGlasses.jsx';
import InventSlots from './InventSlots.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const PROTEINS_SHOWN = 12;
const NO_PINS = [];
const SLOT_LABELS = { notHave: 'you’d need' };

const normKey = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function InventSauce({
  kitchen = [],
  assumeBasics = true,
  sauces = [],
  families = [],
  meta = [],
  catMap = null,
  names = null,
  pairingIndex = null,
  sauceIndex = null,
  categoryOf = null,
  initialStyle = 'Béchamel',
  seed = null,
  wineStyles = undefined, // injectable for tests; undefined → lazy-load
  onClose,
  onSelectSauce,
  onOpenRecipeLab,
}) {
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const proteins = useMemo(() => proteinVocabulary(sauces).slice(0, PROTEINS_SHOWN), [sauces]);
  const cats = useMemo(
    () => catMap || new Map((meta || []).filter((i) => i?.name && i.category).map((i) => [normKey(i.name), i.category])),
    [catMap, meta],
  );
  const pool = useMemo(() => buildSaucePool(meta, sauces), [meta, sauces]);
  const searchPins = seed?.pinned || NO_PINS;

  const rankFor = (protein, pantryOnly) => (slot, currentKeys) => rankSauceSlot({
    slot, currentKeys, protein, kitchen, assumeBasics, pantryOnly, pool, catMap: cats, pairingIndex, sauceIndex, names,
  });

  // Seed + fill for a (technique, protein, pantry switch); search pins stay locked in.
  const seedFor = (sid, protein, pantryOnly) => {
    const pinned = searchPins.map((p) => ({ key: p.key, source: 'search' }));
    const skel = sauceSkeleton(sid, { catMap: cats });
    const seeded = seedBuild(skel, { lab: 'sauce', baseline: { styleId: sid, protein }, pinned });
    // Pins arrive without a pantry flag; give them one so "you'd need" shows on them too.
    const flag = (l) => (l && l.have === undefined ? { ...l, have: haveSauceKey(l.key, { kitchen, assumeBasics, names }) } : l);
    const flagged = { ...seeded, slots: seeded.slots.map((sl) => ({ ...sl, line: flag(sl.line) })), extras: seeded.extras.map(flag) };
    return fillRequired(flagged, rankFor(protein, pantryOnly));
  };

  const [state, setState] = useState(() => {
    const styleId = INVENT_STYLE_BY_ID.has(seed?.styleId) ? seed.styleId : initialStyle;
    const protein = seed?.protein || null;
    return { styleId, protein, pantryOnly: false, build: seedFor(styleId, protein, false) };
  });
  const [notice, setNotice] = useState(() => (state.build.rejected.length ? state.build.rejected.map((r) => r.reason).join(' ') : null));
  const { styleId, protein, pantryOnly, build } = state;
  const style = INVENT_STYLE_BY_ID.get(styleId) || INVENT_STYLES[0];

  const reseed = (sid, prot, only) => {
    const next = seedFor(sid, prot, only);
    setState({ styleId: sid, protein: prot, pantryOnly: only, build: next });
    setNotice(next.rejected.length ? next.rejected.map((r) => r.reason).join(' ') : null);
  };
  const update = (res) => {
    if (res.ok) { setState((st) => ({ ...st, build: res.build })); setNotice(null); } else setNotice(res.reason);
    return res.ok;
  };

  const [styles, setStyles] = useState(wineStyles ?? null);
  useEffect(() => {
    if (wineStyles !== undefined || !protein || styles) return undefined;
    let cancelled = false;
    loadWineStyles(import.meta.env.BASE_URL).then((d) => { if (!cancelled && d) setStyles(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [protein, styles, wineStyles]);

  const sauce = useMemo(
    () => sauceFromBuild(build, { styleId, protein, catMap: cats, pairingIndex, sauceIndex, kitchen, assumeBasics, names }),
    [build, styleId, protein, cats, pairingIndex, sauceIndex, kitchen, assumeBasics, names],
  );
  const keys = useMemo(() => sauce.lines.map((l) => l.key), [sauce]);
  const nearest = useMemo(() => (keys.length ? nearestSauces(keys, sauces, 1) : []), [keys, sauces]);
  const wine = useMemo(() => (protein && styles?.wines && keys.length
    ? winesForSauce({ ingredients: keys, proteins: [protein] }, styles.wines, { categoryOf: categoryOf || undefined })[0] || null
    : null), [protein, styles, keys, categoryOf]);
  const amounts = useMemo(() => new Map(sauce.lines.map((l) => [l.key, l.amount])), [sauce]);
  const needs = missing(build);
  const family = familyById.get(style.familyId);
  const color = family?.color || CHALK_DIM;

  const keyFor = (text) => kitchenKey(text, names || undefined);
  const haveOf = (key) => haveSauceKey(key, { kitchen, assumeBasics, names });
  const rank = rankFor(protein, pantryOnly);
  const onPick = (slotId, value) => { const k = keyFor(value); return update(setSlot(build, slotId, k, { have: haveOf(k) })); };
  const onAddExtra = (text) => { const k = keyFor(text); return update(addExtra(build, k, { have: haveOf(k) })); };
  const shortlistFor = (slotId) => shortlist(build, slotId, rank, 8).map((c) => ({ key: c.key, have: !!c.have, note: c.have ? undefined : 'you’d need' }));

  const chip = (active) => ({
    fontFamily: FONT,
    color: active ? CARD_INK : CHALK_CREAM,
    background: active ? CHALK_CREAM : 'transparent',
    borderColor: CHALK_RAIL,
    outlineColor: CHALK_CREAM,
  });
  const actionBtn = { fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM };

  return (
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="sauce-invent" role="dialog" aria-label="Invent a sauce">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2">
        <button type="button" onClick={onClose} data-testid="sauce-invent-close"
          className={`px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`} style={{ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
          ← Back
        </button>
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>Invent a sauce</h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="sauce-invent-source">
          {kitchen.length
            ? `From your pantry (${kitchen.length} item${kitchen.length === 1 ? '' : 's'}) first.`
            : 'Your pantry is empty, so this draws on every ingredient in the sauce list.'}
        </p>

        <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>1 · Technique</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Technique" data-testid="sauce-invent-styles">
          {INVENT_STYLES.map((s) => {
            const fam = familyById.get(s.familyId);
            return (
              <button key={s.id} type="button" aria-pressed={styleId === s.id} onClick={() => reseed(s.id, protein, pantryOnly)}
                className={`pl-1.5 pr-3 py-0.5 rounded-full border min-h-[44px] text-[16px] inline-flex items-center gap-1 ${FOCUS}`} style={chip(styleId === s.id)}>
                <SauceVessel familyName={fam?.name || s.id} color={styleId === s.id ? CARD_INK : (fam?.color || CHALK_DIM)} size={26} />
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="sauce-invent-chemistry">{style.chemistry}</p>

        {proteins.length > 0 && (
          <>
            <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>2 · Serving it with</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Serving it with" data-testid="sauce-invent-proteins">
              <button type="button" aria-pressed={protein == null} onClick={() => reseed(styleId, null, pantryOnly)}
                className={`px-3 py-1 rounded-full border min-h-[44px] text-[16px] ${FOCUS}`} style={chip(protein == null)}>anything</button>
              {proteins.map((p) => (
                <button key={p} type="button" aria-pressed={protein === p} onClick={() => reseed(styleId, p, pantryOnly)}
                  className={`px-3 py-1 rounded-full border min-h-[44px] text-[16px] ${FOCUS}`} style={chip(protein === p)}>{p}</button>
              ))}
            </div>
          </>
        )}

        <label className="mt-2 flex items-center gap-2 min-h-[44px] cursor-pointer text-[15px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
          <input type="checkbox" checked={pantryOnly} onChange={(e) => reseed(styleId, protein, e.target.checked)}
            data-testid="sauce-invent-pantry-only" className="w-5 h-5" style={{ accentColor: CHALK_CREAM }} />
          Only what I have (no shopping)
        </label>

        <article className="mt-4 rounded-xl px-4 py-3" style={{ border: `1px solid ${color}aa`, background: `${color}1a` }} data-testid="sauce-invent-card">
          <div className="flex items-center gap-3 mb-2">
            <SauceVessel familyName={family?.name || ''} color={color} size={72} testid="sauce-invent-vessel" />
            <div className="flex-1 min-w-0">
              <h3 className="text-[28px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }} data-testid="sauce-invent-name">{sauce.name}</h3>
              <p className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                {family?.name || style.id} family · {sauce.description}{protein ? ` · for ${protein}` : ''}
              </p>
            </div>
          </div>

          {needs.length > 0 && (
            <p className="mb-2 text-[15px] rounded-lg px-3 py-2" style={{ fontFamily: SANS, color: CHALK_CREAM, border: `1px dashed ${CHALK_RAIL}` }} data-testid="sauce-invent-missing" role="status">
              Needs {needs.join(' and ')}.{pantryOnly ? ' Nothing in your pantry fits; turn off “Only what I have” to see what could.' : ''}
            </p>
          )}

          <InventSlots build={build} color={color} testidPrefix="sauce-invent-slots" notice={notice} labels={SLOT_LABELS}
            shortlistFor={shortlistFor} amountFor={(k) => amounts.get(k)}
            onPick={onPick} onAddExtra={onAddExtra}
            onClear={(slotId) => { setState((st) => ({ ...st, build: clearSlot(st.build, slotId) })); setNotice(null); }}
            onRemoveExtra={(k) => { setState((st) => ({ ...st, build: removeExtra(st.build, k) })); setNotice(null); }} />

          {sauce.need.length > 0 && (
            <p className="mt-2 text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="sauce-invent-shopping">
              You’d need: {sauce.need.join(', ')}.
            </p>
          )}

          <p className="mt-2 text-[12px] uppercase tracking-wider" style={{ color: CHALK_SUB }}>Method · {sauce.technique}</p>
          <p className="text-[14px] leading-snug" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="sauce-invent-method">
            {sauce.method || 'Fill the empty required slots to see the method.'}
          </p>
          <p className="mt-2 text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="sauce-invent-why">{sauce.why}</p>
          <p className="mt-1 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="sauce-invent-honest">
            An idea from what pairs, not a tested recipe — taste and adjust.
          </p>

          {wine && (
            <div className="mt-3 flex items-center gap-2.5" data-testid="sauce-invent-wine">
              <WineGlass family={wine.wine.family} color={familyColor(styles?.families, wine.wine.family)} size={36} />
              <div className="min-w-0">
                <div className="text-[18px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{wine.wine.name}</div>
                <div className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>wine with {protein}{wine.reason ? ` · ${wine.reason}` : ''}</div>
              </div>
            </div>
          )}

          {nearest.length > 0 && (
            <div className="mt-3" data-testid="sauce-invent-nearest">
              <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Closest existing sauce</p>
              {nearest.map((x) => {
                const fam = familyById.get(x.sauce.family_id);
                return (
                  <button key={x.sauce.name} type="button" onClick={() => onSelectSauce?.(x.sauce.name)}
                    className={`w-full text-left flex items-center gap-2 py-0.5 min-h-[44px] rounded-md ${FOCUS}`} style={{ outlineColor: CHALK_CREAM }}>
                    <SauceVessel familyName={fam?.name || ''} color={fam?.color || CHALK_DIM} size={30} />
                    <span className="text-[19px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{x.sauce.name}</span>
                    <span className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{Math.round(x.similarity * 100)}% alike</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => reseed(styleId, protein, pantryOnly)} data-testid="sauce-invent-restart"
              className={`px-3 py-2 rounded-lg border min-h-[44px] ${FOCUS}`} style={actionBtn}>
              Start over
            </button>
            {onOpenRecipeLab && (
              <button type="button" data-testid="sauce-invent-notebook"
                onClick={() => onOpenRecipeLab([...keys, ...(protein ? [proteinIngredient(protein)] : [])])}
                className={`px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`}
                style={{ fontFamily: FONT, fontSize: 18, color: CARD_INK, background: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
                Open in Recipe Notebook →
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
