/**
 * InventSauce — "Invent a sauce" for the Sauce Lab. The sauce counterpart
 * of InventCocktail.
 *
 * Pick a technique (one of the SAUCE_TEMPLATES skeletons: roux, emulsion,
 * reduction, tomato, curry base, …) and optionally a protein to serve it
 * with. The panel fills each role from the cook's pantry first (falling
 * back to the ingredients most used for that role, marked "you'd need"),
 * ranked by pairing with the protein and with each other
 * (src/data/inventSauce.js), and shows three inventions: name, family
 * vessel, ingredients with amounts, the technique as the method, the
 * closest existing sauce, and — with a protein — a wine (winesForSauce).
 * "Only what I have" never falls back: a missing emulsifier or liquid is
 * named instead of invented around. Shuffle steps to the next three.
 */
import { useEffect, useMemo, useState } from 'react';
import { INVENT_STYLES, inventSauces, proteinVocabulary } from '../data/inventSauce.js';
import { nearestSauces } from '../data/sauceSimilarity.js';
import { winesForSauce, proteinIngredient } from '../data/sauceWines.js';
import { loadWineStyles, familyColor } from '../data/wineStyles.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, CARD_INK, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { SauceVessel } from './sauceVessels.jsx';
import { WineGlass } from './wineGlasses.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const PER_PAGE = 3;
const PROTEINS_SHOWN = 12;

function InventionCard({ inv, family, protein, nearest, wine, wineFamilies, onSelectSauce, onOpenRecipeLab, familyById }) {
  const color = family?.color || CHALK_DIM;
  return (
    <article className="mt-4 rounded-xl px-4 py-3" style={{ border: `1px solid ${color}aa`, background: `${color}1a` }} data-testid="sauce-invent-card">
      <div className="flex items-center gap-3 mb-2">
        <SauceVessel familyName={family?.name || ''} color={color} size={72} testid="sauce-invent-vessel" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[28px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }} data-testid="sauce-invent-name">{inv.name}</h3>
          <p className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
            {family?.name || inv.styleId} family · {inv.description}{protein ? ` · for ${protein}` : ''}
          </p>
        </div>
      </div>

      <table className="w-full" data-testid="sauce-invent-lines">
        <caption className="sr-only">Ingredients</caption>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.key} className="align-baseline">
              <td className="text-[13px] pr-2 py-0.5 text-right w-[38%]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{l.amount}</td>
              <td className="py-0.5">
                <span className="block text-[20px] leading-tight" style={{ fontFamily: FONT, color: CHALK_CREAM }}>
                  {l.key}
                  {!l.have && <span className="ml-1.5 text-[12px] align-middle" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="sauce-invent-need">you’d need</span>}
                </span>
                <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{l.label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {inv.need.length > 0 && (
        <p className="mt-1 text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="sauce-invent-shopping">
          You’d need: {inv.need.join(', ')}.
        </p>
      )}

      <p className="mt-2 text-[12px] uppercase tracking-wider" style={{ color: CHALK_SUB }}>Method · {inv.technique}</p>
      <p className="text-[14px] leading-snug" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid="sauce-invent-method">{inv.method}</p>
      <p className="mt-2 text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{inv.why}</p>
      <p className="mt-1 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="sauce-invent-honest">
        An idea from what pairs, not a tested recipe — taste and adjust.
      </p>

      {wine && (
        <div className="mt-3 flex items-center gap-2.5" data-testid="sauce-invent-wine">
          <WineGlass family={wine.wine.family} color={familyColor(wineFamilies, wine.wine.family)} size={36} />
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

      {onOpenRecipeLab && (
        <button type="button" data-testid="sauce-invent-notebook"
          onClick={() => onOpenRecipeLab([...inv.lines.map((l) => l.key), ...(protein ? [proteinIngredient(protein)] : [])])}
          className={`mt-3 px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`}
          style={{ fontFamily: FONT, fontSize: 18, color: CARD_INK, background: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
          Open in Recipe Notebook →
        </button>
      )}
    </article>
  );
}

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
  wineStyles = undefined, // injectable for tests; undefined → lazy-load
  onClose,
  onSelectSauce,
  onOpenRecipeLab,
}) {
  const [styleId, setStyleId] = useState(initialStyle);
  const [protein, setProtein] = useState(null);
  const [pantryOnly, setPantryOnly] = useState(false);
  const [page, setPage] = useState(0);
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const proteins = useMemo(() => proteinVocabulary(sauces).slice(0, PROTEINS_SHOWN), [sauces]);
  const style = INVENT_STYLES.find((s) => s.id === styleId) || INVENT_STYLES[0];

  const [styles, setStyles] = useState(wineStyles ?? null);
  useEffect(() => {
    if (wineStyles !== undefined || !protein || styles) return undefined;
    let cancelled = false;
    loadWineStyles(import.meta.env.BASE_URL).then((d) => { if (!cancelled && d) setStyles(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [protein, styles, wineStyles]);

  const result = useMemo(
    () => inventSauces({ styleId, protein, kitchen, assumeBasics, pantryOnly, meta, sauces, catMap, names, pairingIndex, sauceIndex, limit: 12 }),
    [styleId, protein, kitchen, assumeBasics, pantryOnly, meta, sauces, catMap, names, pairingIndex, sauceIndex],
  );
  useEffect(() => { setPage(0); }, [styleId, protein, kitchen, pantryOnly, assumeBasics]);

  const pages = result.ok ? Math.max(1, Math.ceil(result.sauces.length / PER_PAGE)) : 0;
  const shown = useMemo(
    () => (result.ok ? result.sauces.slice((page % pages) * PER_PAGE, (page % pages) * PER_PAGE + PER_PAGE) : []),
    [result, page, pages],
  );

  const cards = useMemo(() => shown.map((inv) => {
    const keys = inv.lines.map((l) => l.key);
    const wine = protein && styles?.wines
      ? winesForSauce({ ingredients: keys, proteins: [protein] }, styles.wines, { categoryOf: categoryOf || undefined })[0] || null
      : null;
    return { inv, nearest: nearestSauces(keys, sauces, 1), wine };
  }), [shown, protein, styles, sauces, categoryOf]);

  const chip = (active) => ({
    fontFamily: FONT,
    color: active ? CARD_INK : CHALK_CREAM,
    background: active ? CHALK_CREAM : 'transparent',
    borderColor: CHALK_RAIL,
    outlineColor: CHALK_CREAM,
  });

  return (
    <div className="fixed inset-x-0 top-0 z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
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

        <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Technique</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Technique" data-testid="sauce-invent-styles">
          {INVENT_STYLES.map((s) => {
            const fam = familyById.get(s.familyId);
            return (
              <button key={s.id} type="button" aria-pressed={styleId === s.id} onClick={() => setStyleId(s.id)}
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
            <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Serve it with</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Serve it with" data-testid="sauce-invent-proteins">
              <button type="button" aria-pressed={protein == null} onClick={() => setProtein(null)}
                className={`px-3 py-1 rounded-full border min-h-[44px] text-[16px] ${FOCUS}`} style={chip(protein == null)}>anything</button>
              {proteins.map((p) => (
                <button key={p} type="button" aria-pressed={protein === p} onClick={() => setProtein(p)}
                  className={`px-3 py-1 rounded-full border min-h-[44px] text-[16px] ${FOCUS}`} style={chip(protein === p)}>{p}</button>
              ))}
            </div>
          </>
        )}

        <label className="mt-2 flex items-center gap-2 min-h-[44px] cursor-pointer text-[15px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
          <input type="checkbox" checked={pantryOnly} onChange={(e) => setPantryOnly(e.target.checked)}
            data-testid="sauce-invent-pantry-only" className="w-5 h-5" style={{ accentColor: CHALK_CREAM }} />
          Only what I have (no shopping)
        </label>

        {!result.ok && (
          <div className="mt-4 rounded-lg px-3 py-3" style={{ border: `1px dashed ${CHALK_RAIL}` }} data-testid="sauce-invent-missing" role="status">
            <p className="text-[20px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>
              Can’t make {/^[aeiou]/i.test(style.label) ? 'an' : 'a'} {style.label.toLowerCase()} from this pantry yet.
            </p>
            <p className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
              {result.missing.length ? `Missing: ${result.missing.join('; ')}. ` : ''}{style.chemistry}
            </p>
          </div>
        )}

        {cards.map(({ inv, nearest, wine }) => (
          <InventionCard key={inv.name + inv.lines.map((l) => l.key).join('|')} inv={inv} family={familyById.get(inv.familyId)}
            protein={protein} nearest={nearest} wine={wine} wineFamilies={styles?.families}
            onSelectSauce={onSelectSauce} onOpenRecipeLab={onOpenRecipeLab} familyById={familyById} />
        ))}

        {result.ok && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPage((i) => i + 1)} disabled={pages < 2} data-testid="sauce-invent-shuffle"
              className={`px-3 py-2 rounded-lg border min-h-[44px] disabled:opacity-40 ${FOCUS}`}
              style={{ fontFamily: FONT, fontSize: 18, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
              🔀 Shuffle
            </button>
            {pages > 1 && <span className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{(page % pages) + 1} of {pages}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
