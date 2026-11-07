/**
 * MyBarPanel — "My bar" for the Cocktail Lab.
 *
 * Add / remove the bottles you have (autocomplete from the cocktail
 * ingredient vocabulary, quick-add chips for the 20 most common), then see
 * what you can make: every drink the bar fully covers, and every drink one
 * ingredient away (named, with a same-role substitute from the bar when
 * there is one). Logic in src/data/myBar.js; the bar itself is stored by
 * the parent (localStorage `fn-my-bar`).
 */
import { useMemo, useState } from 'react';
import { whatCanIMake, commonBarIngredients, barKeyLists, addToBar, removeFromBar, substitutionText } from '../data/myBar.js';
import { buildIngredientVocab } from '../data/ingredientSearch.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { DrinkGlass } from './cocktailGlasses.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ONE_AWAY_SHOWN = 30;

export default function MyBarPanel({
  bar = [],
  onChange,
  cocktails = [],
  families = [],
  roles = {},
  pairingIndex = null,
  onSelectCocktail,
  onInvent,
  onClose,
}) {
  const names = pairingIndex?.names || new Set();
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const [text, setText] = useState('');

  const vocab = useMemo(() => buildIngredientVocab(barKeyLists(cocktails, roles, names)), [cocktails, roles, names]);
  const common = useMemo(() => commonBarIngredients(cocktails, roles, names, 20), [cocktails, roles, names]);
  const result = useMemo(
    () => whatCanIMake(cocktails, bar, { roles, names, pairingIndex }),
    [cocktails, bar, roles, names, pairingIndex],
  );

  const add = (raw) => {
    const next = addToBar(bar, raw, names);
    if (next !== bar) onChange?.(next);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    add(text);
    setText('');
  };

  const pill = { fontFamily: FONT, borderColor: CHALK_RAIL, color: CHALK_CREAM };
  return (
    <div className="fixed inset-x-0 top-0 z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="my-bar-panel" role="dialog" aria-label="My bar">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2 gap-2">
        <button type="button" onClick={onClose} data-testid="my-bar-close"
          className="px-3 py-2 rounded-lg min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}>
          ← Back to the menu
        </button>
        {onInvent && (
          <button type="button" onClick={onInvent} data-testid="my-bar-invent"
            className="px-3 py-2 rounded-lg min-h-[44px]" style={{ fontFamily: FONT, fontSize: 18, color: '#0a0a0a', background: CHALK_CREAM }}>
            Invent a cocktail →
          </button>
        )}
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>My bar</h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }}>
          What you have on the shelf. Kept on this device only.
        </p>

        <form onSubmit={submit} className="flex gap-2">
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Add a bottle or ingredient — e.g. rye"
            aria-label="Add an ingredient to my bar" list="my-bar-vocab" data-testid="my-bar-input"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-md focus:outline-none text-[17px]"
            style={{ fontFamily: FONT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
          />
          <datalist id="my-bar-vocab">{vocab.map((v) => <option key={v} value={v} />)}</datalist>
          <button type="submit" data-testid="my-bar-add" className="px-4 rounded-md min-h-[44px] border" style={pill}>Add</button>
        </form>

        <ul className="mt-3 flex flex-wrap gap-1.5" data-testid="my-bar-items" aria-label="In my bar">
          {bar.length === 0 && (
            <li className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Your bar is empty — add what you have, or tap the common ones below.</li>
          )}
          {bar.map((k) => (
            <li key={k}>
              <button type="button" onClick={() => onChange?.(removeFromBar(bar, k))} aria-label={`Remove ${k}`}
                className="px-3 py-1 rounded-full border min-h-[36px] text-[17px]" style={{ ...pill, background: 'rgba(245,239,222,0.08)' }}>
                {k} <span aria-hidden="true" style={{ color: CHALK_SUB }}>×</span>
              </button>
            </li>
          ))}
        </ul>

        {common.some((k) => !bar.includes(k)) && (
          <div className="mt-3">
            <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Quick add — most used in cocktails</p>
            <div className="flex flex-wrap gap-1.5" data-testid="my-bar-quick">
              {common.filter((k) => !bar.includes(k)).map((k) => (
                <button key={k} type="button" onClick={() => add(k)}
                  className="px-2.5 py-1 rounded-full border min-h-[36px] text-[15px]" style={{ ...pill, borderStyle: 'dashed', color: CHALK_DIM }}>
                  + {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {bar.length > 0 && (
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
                          missing {m.missing[0].key}
                          {m.suggestion ? ` · or use your ${m.suggestion.use} in its place` : ''}
                          {m.substitutions.length ? ` · ${substitutionText(m.substitutions)}` : ''}
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
