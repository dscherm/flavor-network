/**
 * WineLab — a chalkboard wine list (public/data/wine_styles.json).
 *
 * Two modes:
 *   - Browse: wine styles grouped by family (Sparkling → Fortified) or by
 *     country of origin, with a search box that matches name, grape,
 *     country, region, aroma and classic food ("salmon", "nebbiolo",
 *     "tuscany"), colour chips, and country → region chips.
 *   - Matches: entered from a recipe ("Matching wines"); shows the ranked
 *     wines from src/data/winePairing.js with the reason for each.
 * Tapping a wine opens the shared LabNodeCard with its structure, grapes,
 * tasting notes, similar wines and classic foods.
 */
import { useEffect, useMemo, useState } from 'react';
import LabNodeCard from './LabNodeCard.jsx';
import { loadWineStyles, similarWines, wineSearchText, dots, familyColor, fromCountry, countryIndex } from '../data/wineStyles.js';
import { scaleWord } from '../data/winePairing.js';
import { wineProfileAxes, wineFoodMapping, reviewHighlights } from '../data/wineProfile.js';
import ProfileRadar from './ProfileRadar.jsx';
import { CountryFlag, ChalkLoader } from './chalkArt.jsx';
import { WineGlass } from './wineGlasses.jsx';
import { liftColor } from '../data/drinkColor.js';
import { parseQuery, matchItem } from '../data/ingredientSearch.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const COLOUR_CHIPS = [
  { key: null, label: 'All' },
  { key: 'red', label: 'Red' },
  { key: 'white', label: 'White' },
  { key: 'rosé', label: 'Rosé' },
  { key: 'sparkling', label: 'Sparkling' },
  { key: 'sweet', label: 'Sweet & fortified' },
];

function chipMatches(wine, key) {
  if (!key) return true;
  if (key === 'sparkling') return Boolean(wine.sparkling);
  if (key === 'sweet') return wine.family === 'sweet' || wine.family === 'fortified';
  return wine.colour === key;
}

function ProfileHeading({ children, color = CHALK_DIM }) {
  return (
    <div className="uppercase tracking-[0.16em] mb-1.5 mt-3"
      style={{ color, fontFamily: FONT, fontSize: 'clamp(13px, 1.7vh, 18px)', textShadow: CHALK_SHADOW }}>
      {children}
    </div>
  );
}

/**
 * "Flavour profile" + "Pairs by profile" sections of the wine card: the
 * structure radar, the aroma families, and the structure → food rules
 * (src/data/wineProfile.js, which restates the pairing engine's rules).
 */
export function WineProfileSections({ wine, color, reviewEntry = null }) {
  const profile = wineProfileAxes(wine);
  const mapping = wineFoodMapping(wine);
  const reviewed = reviewHighlights(reviewEntry);
  return (
    <div data-testid="wine-profile">
      <ProfileHeading>Flavour profile</ProfileHeading>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <ProfileRadar axes={profile.axes.map((a) => a.key)} values={profile.values} label="structure" color={color} size={170} />
        <ul className="flex-1 min-w-[180px] max-w-full flex flex-col gap-1.5" data-testid="wine-aroma-families" aria-label="Aroma families">
          {profile.aromaFamilies.map((f) => (
            <li key={f.id} className="flex flex-col">
              <div className="flex items-baseline gap-2" style={{ fontFamily: FONT, fontSize: 18, color: CHALK_CREAM }}>
                <span className="inline-block rounded-full flex-shrink-0" style={{ width: 9, height: 9, background: f.color }} aria-hidden="true" />
                <span>{f.label}</span>
                <span className="ml-auto text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{Math.round(f.share * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} aria-hidden="true">
                <div className="h-1.5 rounded-full" style={{ width: `${Math.max(8, f.share * 100)}%`, background: f.color }} />
              </div>
              <div className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{f.tags.join(', ')}</div>
            </li>
          ))}
        </ul>
      </div>

      {reviewed && (
        <div className="mt-2" data-testid="wine-review-aromas">
          <div className="text-[12px] mb-1" style={{ fontFamily: SANS, color: CHALK_SUB }}>
            What {reviewed.reviews.toLocaleString()} critics' reviews mention most:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reviewed.families.map((f) => (
              <span key={f.family} className="px-2 py-0.5 rounded-full border"
                style={{ fontFamily: FONT, fontSize: 16, color: CHALK_CREAM, borderColor: `${color}88`, background: `${color}1a` }}>
                {f.family} <span style={{ fontFamily: SANS, fontSize: 11, color: CHALK_DIM }}>{Math.round(f.share * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <ProfileHeading>Pairs by profile</ProfileHeading>
      <ul className="flex flex-col gap-2" data-testid="wine-food-mapping">
        {mapping.rules.map((r) => (
          <li key={r.id} data-testid={`wine-rule-${r.id}`} className="flex flex-col gap-0.5">
            <div style={{ fontFamily: FONT, fontSize: 19, color: CHALK_CREAM, lineHeight: 1.25 }}>
              <span className="px-1.5 mr-1.5 rounded border text-[11px] align-middle whitespace-nowrap"
                style={{ fontFamily: SANS, color: CHALK_DIM, borderColor: `${color}88`, background: `${color}1a` }}>{r.trait}</span>
              {r.text}
            </div>
            {r.examples.length > 0 && (
              <div className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>e.g. {r.examples.join(', ')}</div>
            )}
          </li>
        ))}
        {mapping.bridges.length > 0 && (
          <li data-testid="wine-rule-bridges" style={{ fontFamily: FONT, fontSize: 19, color: CHALK_CREAM, lineHeight: 1.25 }}>
            <span className="px-1.5 mr-1.5 rounded border text-[11px] align-middle whitespace-nowrap"
              style={{ fontFamily: SANS, color: CHALK_DIM, borderColor: `${color}88`, background: `${color}1a` }}>aromas</span>
            Echo {mapping.bridges.join('; ')}
          </li>
        )}
      </ul>
      {mapping.avoid.length > 0 && (
        <>
          <ProfileHeading>Avoid</ProfileHeading>
          <ul className="flex flex-col gap-1" data-testid="wine-avoid">
            {mapping.avoid.map((a) => (
              <li key={a.id} className="flex gap-2" style={{ fontFamily: FONT, fontSize: 18, color: CHALK_DIM, lineHeight: 1.25 }}>
                <span aria-hidden="true" style={{ color: CHALK_SUB }}>✕</span><span>{a.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** One wine row in the list. */
function WineRow({ wine, color, onSelect, reasons = null, badge = null }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(wine.id)}
      data-testid={`wine-row-${wine.id}`}
      className="w-full flex items-center gap-2.5 pl-1.5 pr-3 py-2 rounded-md text-left transition-colors"
      style={{
        background: `linear-gradient(135deg, ${color}30, ${color}10)`,
        border: `1.5px solid ${color}aa`,
        boxShadow: `0 0 10px ${color}33, 0 2px 6px rgba(0,0,0,0.35)`,
      }}
    >
      <WineGlass family={wine.family} color={color} size={50} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="flex-1 min-w-0 truncate text-[20px]" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>{wine.name}</span>
        {badge && (
          <span className="text-[10px] px-1.5 py-px rounded border flex-shrink-0" style={{ color: CHALK_CREAM, borderColor: `${color}aa` }}>{badge}</span>
        )}
      </div>
      <div className="text-[11px] truncate" style={{ fontFamily: SANS, color: CHALK_DIM }}>
        <CountryFlag country={wine.country} height={10} /> {wine.area ? `${wine.area}, ${wine.country}` : wine.region} · {wine.grapes.join(', ')}
      </div>
      <div className="text-[11px] flex flex-wrap gap-x-3" style={{ fontFamily: SANS, color: CHALK_SUB }} aria-label={`body ${wine.body}, acidity ${wine.acidity}, tannin ${wine.tannin}, sweetness ${wine.sweetness} out of 5`}>
        <span>body <span style={{ color: CHALK_DIM }}>{dots(wine.body)}</span></span>
        <span>acid <span style={{ color: CHALK_DIM }}>{dots(wine.acidity)}</span></span>
        <span>tannin <span style={{ color: CHALK_DIM }}>{dots(wine.tannin)}</span></span>
        <span>sweet <span style={{ color: CHALK_DIM }}>{dots(wine.sweetness)}</span></span>
      </div>
      {reasons && reasons.length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid="wine-match-reasons">
          {reasons.map((r) => (
            <span key={r} className="text-[11px] px-1.5 py-px rounded-full border" style={{ fontFamily: SANS, color: CHALK_DIM, borderColor: `${CHALK_RAIL}` }}>{r}</span>
          ))}
        </div>
      )}
      </div>
    </button>
  );
}

/**
 * The family filter as a back-bar shelf: one chalk glass per family on a
 * shelf line, a slanted chalk tag with the name, and a count. Tap a glass
 * to show only that family; tap it again (or "All wines") to clear. Ten
 * glasses do not fit a phone at a readable size, so the shelf swipes.
 */
function WineShelf({ families, counts, active, onPick }) {
  return (
    <div className="px-4 pt-1 pb-2 max-w-4xl mx-auto" data-testid="wine-shelf">
      <div className="flex items-baseline justify-between mb-1 min-h-[32px]">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: CHALK_SUB }}>Families</span>
        {active && (
          <button type="button" onClick={() => onPick(null)} className="text-[15px] underline underline-offset-2 min-h-[32px] px-1"
            style={{ fontFamily: FONT, color: CHALK_DIM }} data-testid="wine-shelf-clear">
            All wines
          </button>
        )}
      </div>
      <div className="flex overflow-x-auto chip-row pb-1 pr-2" role="group" aria-label="Filter by wine family">
        {families.map((fam, i) => {
          const count = counts.get(fam.id) || 0;
          const on = active === fam.id;
          const dim = (active != null && !on) || count === 0;
          const ink = on ? CHALK_CREAM : liftColor(fam.color);
          const fade = { opacity: dim ? 0.45 : 1, transition: 'opacity .15s' };
          return (
            <button
              key={fam.id}
              type="button"
              aria-pressed={on}
              aria-label={`${fam.name}, ${count} wine${count === 1 ? '' : 's'}`}
              data-testid={`wine-shelf-${fam.id}`}
              onClick={() => onPick(on ? null : fam.id)}
              className="flex-shrink-0 flex flex-col items-center w-[78px] pt-1 pb-1 rounded-md focus-visible:outline focus-visible:outline-2"
              style={{ outlineColor: CHALK_CREAM }}
            >
              <span className="h-[70px] flex items-end" style={fade}>
                <WineGlass family={fam.id} color={fam.color} size={68} dashed={!on} dim={!on && active != null} testid={`wine-shelf-glass-${fam.id}`} />
              </span>
              {/* the shelf: a chalk plank under every glass, joined slot to slot */}
              <span aria-hidden="true" className="block w-full" style={{ borderTop: `3px solid ${CHALK_DIM}cc`, borderBottom: `2px solid ${CHALK_RAIL}99`, height: 7 }} />
              <span
                className="mt-1.5 text-[15px] leading-[1.05] text-center px-1.5 py-0.5 rounded-sm max-w-full min-h-[2.3em] flex items-center justify-center"
                style={{ ...fade, fontFamily: FONT, color: ink, border: `1px dashed ${ink}99`, background: `${fam.color}1a`, transform: `rotate(${i % 2 ? 5 : -5}deg)`, textShadow: CHALK_SHADOW, boxShadow: on ? `0 0 10px ${fam.color}66` : `0 0 8px ${fam.color}33` }}
              >
                {fam.name}
              </span>
              <span className="text-[12px] mt-1" style={{ ...fade, fontFamily: FONT, color: CHALK_DIM }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WineLab({
  matchesContext = null, // { recipeName, items: [{ item, similarity, reasons }], returnTab }
  onExitMatches = () => {},
  onBackToRecipe = null,
}) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [colour, setColour] = useState(null);
  const [country, setCountry] = useState(null);
  const [area, setArea] = useState(null);
  const [groupBy, setGroupBy] = useState('style'); // 'style' | 'country'
  const [family, setFamily] = useState(null); // wine family id from the glass shelf

  useEffect(() => {
    let cancelled = false;
    loadWineStyles(import.meta.env.BASE_URL).then((d) => {
      if (cancelled) return;
      if (d) setData(d); else setFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Review-derived aromas (optional; the card works without them).
  const [reviewAromas, setReviewAromas] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/wine_review_aromas.json`)
      .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
      .then((d) => { if (!cancelled && d?.styles) setReviewAromas(d.styles); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const families = data?.families || [];
  const wines = data?.wines || [];
  const byId = useMemo(() => new Map(wines.map((w) => [w.id, w])), [wines]);

  // Everything but the family filter. The glass shelf counts from this,
  // so each glass says what tapping it would give.
  const beforeFamily = useMemo(() => {
    const terms = parseQuery(search);
    return wines.filter((w) => chipMatches(w, colour)
      && fromCountry(w, country)
      && (!area || (w.country === country && w.area === area))
      && (terms.length === 0 || matchItem({ name: w.name, ingredients: wineSearchText(w) }, terms).match));
  }, [wines, search, colour, country, area]);
  const visible = useMemo(() => (family ? beforeFamily.filter((w) => w.family === family) : beforeFamily), [beforeFamily, family]);
  const familyCounts = useMemo(() => {
    const m = new Map();
    for (const w of beforeFamily) m.set(w.family, (m.get(w.family) || 0) + 1);
    return m;
  }, [beforeFamily]);

  // Country chips count within the colour + search filters (not the
  // country filter itself), so each chip says what tapping it would give.
  const countries = useMemo(() => {
    const terms = parseQuery(search);
    return countryIndex(wines.filter((w) => chipMatches(w, colour)
      && (!family || w.family === family)
      && (terms.length === 0 || matchItem({ name: w.name, ingredients: wineSearchText(w) }, terms).match)));
  }, [wines, search, colour, family]);
  const areasForCountry = countries.find((c) => c.country === country)?.areas || [];
  const filtersActive = Boolean(search.trim() || colour || country || family);

  // Reasons for the selected wine when it was opened from a match list.
  const matchReasons = useMemo(() => {
    const m = matchesContext?.items?.find((x) => x.item?.id === selectedId);
    return m?.reasons || null;
  }, [matchesContext, selectedId]);

  const selected = selectedId ? (byId.get(selectedId) || matchesContext?.items?.find((x) => x.item?.id === selectedId)?.item) : null;

  const card = selected && (
    <LabNodeCard
      kind="wine"
      name={selected.name}
      clusterName={families.find((f) => f.id === selected.family)?.name || selected.family}
      clusterColor={familyColor(families, selected.family)}
      clusterTag={selected.area ? `${selected.area}, ${selected.country}` : selected.region}
      headerArt={<WineGlass family={selected.family} color={familyColor(families, selected.family)} size={96} testid="wine-card-glass" />}
      details={[
        ...(matchReasons ? [{ label: `Why with ${matchesContext.recipeName}`, value: matchReasons.join('; ') }] : []),
        { label: 'Country', value: <><CountryFlag country={selected.country} height={13} /> {(selected.countries || [selected.country]).join(', ')}</> },
        { label: 'Region', value: selected.area || selected.region },
        { label: 'Body', value: scaleWord('body', selected.body) },
        { label: 'Acidity', value: scaleWord('acidity', selected.acidity) },
        { label: 'Tannin', value: scaleWord('tannin', selected.tannin) },
        { label: 'Sweetness', value: scaleWord('sweetness', selected.sweetness) },
        { label: 'Oak', value: ['none', 'some', 'pronounced'][selected.oak] },
        { label: 'Serve at', value: `${selected.serveC} °C` },
      ]}
      ingredients={selected.grapes}
      ingredientsLabel="Grapes"
      prep={selected.notes}
      prepLabel="Tasting notes"
      likeThis={similarWines(selected, wines.length ? wines : [], 6).map((w) => ({ name: w.name, color: familyColor(families, w.family) }))}
      pairsWith={selected.classicMatches}
      onSelect={(name) => { const w = wines.find((x) => x.name === name); if (w) setSelectedId(w.id); }}
      onClose={() => setSelectedId(null)}
    >
      <WineProfileSections wine={selected} color={familyColor(families, selected.family)} reviewEntry={reviewAromas?.[selected.id]} />
    </LabNodeCard>
  );

  // ── Matches mode ────────────────────────────────────────────────────
  if (matchesContext) {
    return (
      <div className="absolute inset-x-0 top-0 overflow-y-auto" style={{ bottom: 'var(--tab-bar-h)', ...chalkSurfaceStyle(), color: CHALK_CREAM }} data-testid="wine-matches">
        <div className="sticky top-0 z-30 px-4 py-3 flex items-center gap-2 backdrop-blur-md" style={{ background: '#0a0a0aE6', borderBottom: `1px solid ${CHALK_RAIL}66` }}>
          {onBackToRecipe && (
            <button type="button" onClick={onBackToRecipe} data-testid="wine-matches-back"
              className="px-3 py-1.5 rounded-lg text-[15px]" style={{ fontFamily: FONT, color: CHALK_CREAM, border: `1px solid ${CHALK_RAIL}` }}>
              ← Back to recipe
            </button>
          )}
          <span className="flex-1 text-[22px] truncate" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>Wines for {matchesContext.recipeName}</span>
          <button type="button" onClick={onExitMatches} className="text-[13px] underline underline-offset-2 flex-shrink-0" style={{ color: CHALK_DIM }}>
            Whole list
          </button>
        </div>
        <ul className="px-4 py-4 max-w-2xl mx-auto grid grid-cols-1 gap-2 pb-24">
          {matchesContext.items.map(({ item, reasons }, i) => (
            <li key={item.id}>
              <WineRow
                wine={item}
                color={familyColor(families, item.family)}
                onSelect={setSelectedId}
                reasons={reasons}
                badge={i === 0 ? 'best match' : null}
              />
            </li>
          ))}
          {matchesContext.items.length === 0 && (
            <li className="text-center py-10" style={{ fontFamily: FONT, color: CHALK_SUB }}>No wine data for this recipe yet.</li>
          )}
        </ul>
        {card}
      </div>
    );
  }

  // ── Browse mode ─────────────────────────────────────────────────────
  if (!data) {
    return (
      failed ? (
        <div className="flex items-center justify-center w-full h-full pt-10" style={chalkSurfaceStyle()}>
          <p className="text-base" style={{ fontFamily: FONT, color: CHALK_SUB }}>Could not load the wine list.</p>
        </div>
      ) : <ChalkLoader label="Uncorking the wine list…" color="#9f1239" />
    );
  }

  return (
    <div className="absolute inset-x-0 top-0 overflow-y-auto" style={{ bottom: 'var(--tab-bar-h)', paddingTop: 'env(safe-area-inset-top, 0px)', ...chalkSurfaceStyle(), color: CHALK_CREAM }} data-wine-browse-root>
      <div className="px-4 pt-5 pb-2 max-w-4xl mx-auto text-center">
        <h1 className="text-5xl" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>Wine List</h1>
        <p className="text-[15px] mt-1" style={{ fontFamily: FONT, color: CHALK_SUB }}>
          {wines.length} styles · open any Cookbook recipe and tap “Matching wines” to pair one
        </p>
      </div>

      <WineShelf families={families} counts={familyCounts} active={family} onPick={setFamily} />

      <div className="sticky top-0 z-30 backdrop-blur-md px-4 py-2.5 max-w-4xl mx-auto" style={{ background: '#0a0a0aE6', borderBottom: `1px solid ${CHALK_RAIL}66` }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wine, grape, aroma or food — e.g. salmon"
          aria-label="Search wines by name, grape, aroma or food"
          className="w-full px-2.5 py-1.5 rounded-md focus:outline-none text-[16px] mb-1.5"
          style={{ fontFamily: FONT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by colour">
          {COLOUR_CHIPS.map((c) => {
            const active = colour === c.key;
            return (
              <button key={String(c.key)} type="button" aria-pressed={active} onClick={() => setColour(active ? null : c.key)}
                className="px-3 py-0.5 rounded-full text-[15px] border"
                style={{ fontFamily: FONT, color: active ? '#0a0a0a' : CHALK_CREAM, background: active ? CHALK_CREAM : 'rgba(255,255,255,0.04)', borderColor: active ? CHALK_CREAM : `${CHALK_RAIL}99` }}>
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5 overflow-x-auto chip-row pb-0.5" role="group" aria-label="Filter by country">
          {countries.map((c) => {
            const active = country === c.country;
            return (
              <button key={c.country} type="button" aria-pressed={active}
                data-testid={`wine-country-${c.country}`}
                onClick={() => { setCountry(active ? null : c.country); setArea(null); }}
                className="px-2.5 py-0.5 rounded-full text-[14px] border whitespace-nowrap flex-shrink-0"
                style={{ fontFamily: FONT, color: active ? '#0a0a0a' : CHALK_CREAM, background: active ? CHALK_CREAM : 'rgba(255,255,255,0.04)', borderColor: active ? CHALK_CREAM : `${CHALK_RAIL}99` }}>
                <CountryFlag country={c.country} height={11} /> {c.country} {c.count}
              </button>
            );
          })}
        </div>
        {country && areasForCountry.length > 1 && (
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto chip-row pb-0.5" role="group" aria-label={`Filter ${country} by region`}>
            {areasForCountry.map((a) => {
              const active = area === a.area;
              return (
                <button key={a.area} type="button" aria-pressed={active}
                  onClick={() => setArea(active ? null : a.area)}
                  className="px-2.5 py-0.5 rounded-full text-[13px] border whitespace-nowrap flex-shrink-0"
                  style={{ fontFamily: SANS, color: active ? '#0a0a0a' : CHALK_DIM, background: active ? CHALK_DIM : 'transparent', borderColor: `${CHALK_RAIL}99` }}>
                  {a.area} {a.count}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[13px]" style={{ color: CHALK_SUB }}>
          <span>Group by</span>
          {[['style', 'Style'], ['country', 'Country']].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={groupBy === key} onClick={() => setGroupBy(key)}
              className="underline-offset-2" style={{ color: groupBy === key ? CHALK_CREAM : CHALK_DIM, textDecoration: groupBy === key ? 'underline' : 'none' }}>
              {label}
            </button>
          ))}
          {filtersActive && (
            <span className="ml-auto" aria-live="polite">{visible.length} wine{visible.length === 1 ? '' : 's'} shown</span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-4xl mx-auto pb-24">
        {groupBy === 'country' && countryIndex(visible).map((c) => {
          // A wine sits under its primary country only, so nothing repeats.
          const members = visible.filter((w) => w.country === c.country)
            .sort((a, b) => (a.area || '').localeCompare(b.area || '') || a.name.localeCompare(b.name));
          if (members.length === 0) return null;
          return (
            <section key={c.country} className="mb-6" data-testid={`wine-country-section-${c.country}`}>
              <header className="flex items-center gap-2.5 mb-2 py-1.5" style={{ borderTop: `1.5px solid ${CHALK_RAIL}`, borderBottom: `1.5px solid ${CHALK_RAIL}` }}>
                <CountryFlag country={c.country} height={20} />
                <h2 className="text-[32px] leading-none" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>{c.country}</h2>
                <span className="text-[14px]" style={{ fontFamily: FONT, color: CHALK_SUB }}>· {members.length}</span>
              </header>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-3">
                {members.map((w) => (
                  <li key={w.id}><WineRow wine={w} color={familyColor(families, w.family)} onSelect={setSelectedId} /></li>
                ))}
              </ul>
            </section>
          );
        })}
        {groupBy === 'style' && families.map((fam) => {
          const members = visible.filter((w) => w.family === fam.id);
          if (members.length === 0) return null;
          return (
            <section key={fam.id} className="mb-6" data-testid={`wine-family-${fam.id}`}>
              <header className="flex items-center gap-2.5 mb-2 py-1.5" style={{ borderTop: `1.5px solid ${fam.color}66`, borderBottom: `1.5px solid ${fam.color}66` }}>
                <WineGlass family={fam.id} color={fam.color} size={44} testid={`wine-family-glass-${fam.id}`} />
                <h2 className="text-[32px] leading-none" style={{ fontFamily: FONT, color: fam.color, textShadow: CHALK_SHADOW }}>{fam.name}</h2>
                <span className="text-[14px]" style={{ fontFamily: FONT, color: CHALK_SUB }}>· {members.length}</span>
              </header>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-3">
                {members.map((w) => (
                  <li key={w.id}><WineRow wine={w} color={fam.color} onSelect={setSelectedId} /></li>
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 && (
          <div className="text-center text-base py-12" style={{ fontFamily: FONT, color: CHALK_SUB }}>
            No wines match.{' '}
            <button type="button" onClick={() => { setSearch(''); setColour(null); setCountry(null); setArea(null); setFamily(null); }} className="underline underline-offset-2" style={{ color: CHALK_DIM }}>Reset</button>
          </div>
        )}
      </div>
      {card}
    </div>
  );
}
