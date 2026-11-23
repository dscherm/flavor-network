/**
 * MyBarPanel — "My bar" for the Cocktail Lab.
 *
 * Add / remove the bottles you have (autocomplete from the cocktail
 * ingredient vocabulary, quick-add chips for the 20 most common), then see
 * what you can make: every drink the bar fully covers, and every drink one
 * ingredient away (named, with a same-role substitute from the bar when
 * there is one). Logic in src/data/myBar.js; the bar itself is stored by
 * the parent (localStorage `fn-my-bar`).
 *
 * "Add from a photo": a one-time set-up card (an invite code or the user's
 * own Google key, src/data/barScan.js), then photo → scan → a review list.
 * Nothing reaches the bar or kitchen until "Add N to my bar".
 */
import { useMemo, useRef, useState } from 'react';
import { whatCanIMake, commonBarIngredients, barKeyLists, addToBar, removeFromBar, substitutionText, barKey, isBooze, stockFor } from '../data/myBar.js';
import { addToKitchen, removeFromKitchen } from '../data/myKitchen.js';
import { buildIngredientVocab } from '../data/ingredientSearch.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { DrinkGlass } from './cocktailGlasses.jsx';
import BarScanSetup from './BarScanSetup.jsx';
import { Camera, Close } from './ChalkIcons.jsx';
import BarScanReview from './BarScanReview.jsx';
import { usage } from '../data/usageEvents.js';
import { noteTypedIngredient } from '../data/usageIngredient.js';
import { scanMode, loadScanKey, loadScanCode, barVocab, runBarScan, toReviewRows, mergeReviewRows, ScanError } from '../data/barScan.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ONE_AWAY_SHOWN = 30;

export default function MyBarPanel({
  bar = [],
  onChange,
  // The shared kitchen (myKitchen.js): mixers, citrus, syrups, eggs, herbs.
  // The bar holds booze only; cocktails are checked against both.
  kitchen = [],
  onKitchenChange,
  cocktails = [],
  families = [],
  roles = {},
  pairingIndex = null,
  onSelectCocktail,
  onInvent,
  onClose,
  // (args: { file, vocab, key, code }) => Promise<{ bottles, other }>; injectable so tests never touch the network.
  scan = runBarScan,
}) {
  const names = pairingIndex?.names || new Set();
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const [text, setText] = useState('');

  const vocab = useMemo(() => buildIngredientVocab(barKeyLists(cocktails, roles, names)), [cocktails, roles, names]);
  const common = useMemo(() => commonBarIngredients(cocktails, roles, names, 20), [cocktails, roles, names]);
  const stock = useMemo(() => stockFor(bar, kitchen), [bar, kitchen]);
  const result = useMemo(
    () => whatCanIMake(cocktails, stock, { roles, names, pairingIndex }),
    [cocktails, stock, roles, names, pairingIndex],
  );
  // Kitchen items a cocktail could use (shown as their own shared group).
  const cocktailWords = useMemo(() => new Set(vocab), [vocab]);
  const kitchenForDrinks = useMemo(
    () => kitchen.filter((k) => cocktailWords.has(k) && !isBooze(k, roles)),
    [kitchen, cocktailWords, roles],
  );
  const [routed, setRouted] = useState('');

  // Photo scan: view is null | 'setup' | 'review'; busy while reading labels.
  const [scanView, setScanView] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanNote, setScanNote] = useState('');
  const [review, setReview] = useState({ rows: [], other: [] });
  const [mode, setMode] = useState(() => scanMode());
  const fileRef = useRef(null);
  const openPicker = () => fileRef.current?.click();
  const startScan = () => {
    setScanError(null); setScanNote('');
    if (!scanMode()) { setScanView('setup'); return; }
    openPicker();
  };
  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanBusy(true); setScanError(null); setScanNote('');
    const route = scanMode();
    usage.scanStarted(route);
    try {
      const vocabForScan = barVocab(cocktails, roles, names);
      const result = await scan({ file, vocab: vocabForScan, key: loadScanKey(), code: loadScanCode() });
      const next = toReviewRows(result, bar, { names, roles });
      const prev = scanView === 'review' ? review : { rows: [], other: [] };
      if (next.rows.length + next.other.length > 0) usage.scanSucceeded(route, next.rows.length);
      if (next.rows.length === 0 && next.other.length === 0 && prev.rows.length === 0) {
        setScanNote("I couldn't read any labels — try closer, with more light.");
        setScanView(null);
      } else {
        const seen = new Set(prev.other.map((o) => o.kitchenKey));
        setReview({
          rows: mergeReviewRows(prev.rows, next.rows),
          other: [...prev.other, ...next.other.filter((o) => !seen.has(o.kitchenKey)).map((o) => ({ ...o, checked: false }))],
        });
        setScanView('review');
      }
    } catch (err) {
      setScanError(err instanceof ScanError ? err : new ScanError('unreadable'));
    } finally {
      setScanBusy(false);
    }
  };
  const commitScan = (rows, others) => {
    usage.scanKept(scanMode(), rows.length);
    let nextBar = bar;
    for (const r of rows) nextBar = addToBar(nextBar, r.barKey, names);
    if (nextBar !== bar) onChange?.(nextBar);
    if (others.length && onKitchenChange) {
      let nextKitchen = kitchen;
      for (const o of others) nextKitchen = addToKitchen(nextKitchen, o.kitchenKey, names);
      if (nextKitchen !== kitchen) onKitchenChange(nextKitchen);
    }
    setScanNote(`Added ${rows.length} to your bar${others.length ? ` and ${others.length} to your kitchen` : ''}.`);
    setReview({ rows: [], other: [] });
    setScanView(null);
  };

  // Booze goes on the bar shelf; anything else goes to the shared kitchen.
  const add = (raw) => {
    const key = barKey(raw, names);
    if (!key) return;
    if (isBooze(key, roles) || !onKitchenChange) {
      const next = addToBar(bar, raw, names);
      if (next !== bar) onChange?.(next);
      setRouted('');
    } else {
      const next = addToKitchen(kitchen, key, names);
      if (next !== kitchen) onKitchenChange(next);
      setRouted(key);
    }
  };
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    noteTypedIngredient('bar', text, names);
    add(text);
    setText('');
  };

  const pill = { fontFamily: FONT, borderColor: CHALK_RAIL, color: CHALK_CREAM };
  return (
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="my-bar-panel" role="dialog" aria-label="My bar">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2 gap-2">
        <button type="button" onClick={onClose} data-testid="my-bar-close"
          className="px-3 py-2 rounded-lg min-h-[44px] min-w-[44px]" style={{ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}>
          Back to the menu
        </button>
        {onInvent && (
          <button type="button" onClick={onInvent} data-testid="my-bar-invent"
            className="px-3 py-2 rounded-lg min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, color: '#0a0a0a', background: CHALK_CREAM }}>
            Invent a cocktail
          </button>
        )}
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>My bar</h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }}>
          Your bottles. Mixers, citrus, syrups and eggs come from your kitchen, shared with the Recipe and Sauce Labs. Kept on this device only.
        </p>

        <form onSubmit={submit} className="flex gap-2">
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Add a bottle — e.g. rye"
            aria-label="Add an ingredient to my bar" list="my-bar-vocab" data-testid="my-bar-input"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-md focus:outline-none text-[17px]"
            style={{ fontFamily: FONT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
          />
          <datalist id="my-bar-vocab">{vocab.map((v) => <option key={v} value={v} />)}</datalist>
          <button type="submit" data-testid="my-bar-add" className="px-4 rounded-md min-h-[44px] border" style={pill}>Add</button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={startScan} disabled={scanBusy} data-testid="my-bar-photo"
            className="px-3 rounded-md min-h-[44px] border disabled:opacity-50 inline-flex items-center gap-1" style={pill}><Camera size={20} />Add from a photo</button>
          {mode && scanView !== 'setup' && (
            <button type="button" data-testid="my-bar-scan-change" onClick={() => { setScanError(null); setScanView('setup'); }}
              className="px-2 min-h-[44px] text-[14px] underline" style={{ fontFamily: SANS, color: CHALK_SUB }}>Change key or code</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} data-testid="my-bar-photo-input" aria-label="Choose a photo of your bottles" />
        </div>
        {scanBusy && (
          <p role="status" data-testid="my-bar-scan-busy" className="mt-2 text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Reading the labels…</p>
        )}
        {scanError && (
          <div role="alert" data-testid="my-bar-scan-error" className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: '#f2b8a8' }}>
            <p>{scanError.message}</p>
            {(scanError.kind === 'bad-key' || scanError.kind === 'bad-code') && (
              <button type="button" data-testid="my-bar-scan-fix" onClick={() => { setScanError(null); setScanView('setup'); }}
                className="mt-1 px-3 rounded-md min-h-[44px] border" style={pill}>Change key or code</button>
            )}
          </div>
        )}
        {scanNote && !scanError && !scanBusy && (
          <p role="status" data-testid="my-bar-scan-note" className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{scanNote}</p>
        )}
        {scanView === 'setup' && (
          <BarScanSetup
            onSaved={(m) => { setMode(m); setScanView(null); openPicker(); }}
            onClose={() => { setMode(scanMode()); setScanView(null); }}
          />
        )}
        {scanView === 'review' && (
          <BarScanReview
            rows={review.rows} other={review.other} bar={bar} names={names} roles={roles} vocab={vocab}
            onRowsChange={(rows) => setReview((r) => ({ ...r, rows }))}
            onOtherChange={(other) => setReview((r) => ({ ...r, other }))}
            onAdd={commitScan} busy={scanBusy}
            onAnother={openPicker}
            onCancel={() => { setReview({ rows: [], other: [] }); setScanView(null); }}
          />
        )}

        <ul className="mt-3 flex flex-wrap gap-1.5" data-testid="my-bar-items" aria-label="In my bar">
          {bar.length === 0 && (
            <li className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>No bottles yet — add what you have, or tap the common ones below.</li>
          )}
          {bar.map((k) => (
            <li key={k}>
              <button type="button" onClick={() => onChange?.(removeFromBar(bar, k))} aria-label={`Remove ${k}`}
                className="px-3 py-1 rounded-full border min-h-[36px] text-[17px]" style={{ ...pill, background: 'rgba(245,239,222,0.08)' }}>
                {k} <span aria-hidden="true" className="inline-block align-middle" style={{ color: CHALK_SUB, lineHeight: 0 }}><Close size={16} /></span>
              </button>
            </li>
          ))}
        </ul>

        {routed && (
          <p className="mt-2 text-[13px]" role="status" data-testid="my-bar-routed" style={{ fontFamily: SANS, color: CHALK_DIM }}>
            Added {routed} to your kitchen (not a bottle).
          </p>
        )}

        {kitchenForDrinks.length > 0 && (
          <div className="mt-3" data-testid="my-bar-kitchen">
            <p className="text-[13px] mb-1" style={{ fontFamily: SANS, color: CHALK_SUB }}>From your kitchen</p>
            <ul className="flex flex-wrap gap-1.5" aria-label="From your kitchen">
              {kitchenForDrinks.map((k) => (
                <li key={k}>
                  <button type="button" onClick={() => onKitchenChange?.(removeFromKitchen(kitchen, k))} aria-label={`Remove ${k} from your kitchen`}
                    className="px-3 py-1 rounded-full border min-h-[36px] text-[16px]" style={{ ...pill, borderStyle: 'dotted', color: CHALK_DIM }}>
                    {k} <span aria-hidden="true" className="inline-block align-middle" style={{ color: CHALK_SUB, lineHeight: 0 }}><Close size={16} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {common.some((k) => !stock.includes(k)) && (
          <div className="mt-3">
            <p className="text-[13px] mb-1" style={{ fontFamily: SANS, color: CHALK_SUB }}>Most used in cocktails</p>
            <div className="flex flex-wrap gap-1.5" data-testid="my-bar-quick">
              {common.filter((k) => !stock.includes(k)).map((k) => (
                <button key={k} type="button" onClick={() => add(k)}
                  className="px-2.5 py-1 rounded-full border min-h-[36px] text-[15px]" style={{ ...pill, borderStyle: 'dashed', color: CHALK_DIM }}>
                  + {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {stock.length > 0 && (
          <>
            <section className="mt-5" data-testid="my-bar-make">
              <h3 className="text-[24px]" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>You can make ({result.make.length})</h3>
              {result.make.length === 0 && <p className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Nothing complete yet — see what is one bottle away.</p>}
              <ul className="flex flex-col">
                {result.make.map((m) => (
                  <li key={m.cocktail.name}>
                    <button type="button" onClick={() => onSelectCocktail?.(m.cocktail.name)}
                      className="w-full text-left py-1 min-h-[36px] flex items-center gap-2.5">
                      <DrinkGlass cocktail={m.cocktail} familyById={familyById} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[20px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{m.cocktail.name}</span>
                        {m.substitutions.length > 0 && (
                          <span className="block text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{substitutionText(m.substitutions)}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-4" data-testid="my-bar-one-away">
              <h3 className="text-[24px]" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>One away ({result.oneAway.length})</h3>
              <ul className="flex flex-col">
                {result.oneAway.slice(0, ONE_AWAY_SHOWN).map((m) => (
                  <li key={m.cocktail.name}>
                    <button type="button" onClick={() => onSelectCocktail?.(m.cocktail.name)}
                      className="w-full text-left py-1 min-h-[36px] flex items-center gap-2.5">
                      <DrinkGlass cocktail={m.cocktail} familyById={familyById} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[20px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{m.cocktail.name}</span>
                        <span className="block text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                          {`missing ${m.missing[0].key}.`}
                          {m.suggestion ? ` Or use your ${m.suggestion.use} in its place.` : ''}
                          {m.substitutions.length ? ` ${substitutionText(m.substitutions).replace(/\.?$/, '.')}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {result.oneAway.length > ONE_AWAY_SHOWN && (
                <p className="text-[12px]" style={{ color: CHALK_SUB }}>…and {result.oneAway.length - ONE_AWAY_SHOWN} more.</p>
              )}
            </section>
            <p className="mt-3 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
              Water, ice, soda, sugar and garnishes are assumed. A spirit counts for another of its family (any whiskey for a whiskey) — never vodka for gin.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
