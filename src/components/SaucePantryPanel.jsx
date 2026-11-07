/**
 * SaucePantryPanel — "What can I make from my pantry?" for the Sauce Lab.
 * The sauce counterpart of MyBarPanel.
 *
 * Edits the shared kitchen list (src/data/myKitchen.js, localStorage
 * `fn-my-kitchen`, also edited by the Make flow): an add box with
 * autocomplete over sauce ingredient names, quick-add chips for the most
 * used sauce ingredients, and the "assume basics" toggle. Then lists the
 * sauces the pantry covers and those one or two ingredients away, naming
 * what is missing and a same-role stand-in from the pantry when there is
 * one (src/data/saucePantry.js). Each sauce shows its family vessel and
 * opens its sauce card on tap. The kitchen itself is stored by the parent.
 */
import { useMemo, useState } from 'react';
import { addToKitchen, removeFromKitchen, haveIngredient } from '../data/myKitchen.js';
import { whatSauceCanIMake, commonSauceIngredients } from '../data/saucePantry.js';
import { buildIngredientVocab } from '../data/ingredientSearch.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, CARD_INK, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { SauceVessel } from './sauceVessels.jsx';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const NEARLY_SHOWN = 30;
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

function SauceRow({ entry, familyById, onSelect, children }) {
  const s = entry.item;
  const fam = familyById.get(s.family_id);
  return (
    <li>
      <button type="button" onClick={() => onSelect?.(s.name)}
        className={`w-full text-left py-1 min-h-[44px] flex items-center gap-2.5 rounded-md ${FOCUS}`}
        style={{ outlineColor: CHALK_CREAM }}>
        <SauceVessel familyName={fam?.name || s.family || ''} color={fam?.color || CHALK_DIM} size={34} />
        <span className="flex-1 min-w-0">
          <span className="block text-[20px] leading-tight" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{s.name}</span>
          {children}
        </span>
      </button>
    </li>
  );
}

export default function SaucePantryPanel({
  kitchen = [],
  onChange,
  assumeBasics = true,
  onAssumeBasicsChange,
  spiceRack = false,
  onSpiceRackChange,
  sauces = [],
  families = [],
  names = new Set(),      // for resolving what the cook types (catalogue + ingredient graph)
  coverNames = null,      // for matching sauce lines to the pantry (sauce catalogue); defaults to names
  catMap = new Map(),
  pairingIndex = null,
  sauceIndex = null,
  onSelectSauce,
  onInvent,
  onClose,
}) {
  const familyById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const [text, setText] = useState('');

  const vocab = useMemo(() => buildIngredientVocab(sauces.map((s) => s.ingredients || [])), [sauces]);
  const allCommon = useMemo(() => commonSauceIngredients(sauces, 24), [sauces]);
  // Hide chips the pantry already covers (lemon covers lemon juice).
  const common = useMemo(() => {
    const have = new Set(kitchen);
    return allCommon.filter((k) => !haveIngredient(k, have, { assumeBasics: false }).covered).slice(0, 20);
  }, [allCommon, kitchen]);
  const result = useMemo(
    () => whatSauceCanIMake(sauces, kitchen, { assumeBasics, spiceRack, names: coverNames || names, catMap, pairingIndex, sauceIndex }),
    [sauces, kitchen, assumeBasics, spiceRack, names, coverNames, catMap, pairingIndex, sauceIndex],
  );

  const add = (raw) => {
    const next = addToKitchen(kitchen, raw, names);
    if (next !== kitchen) onChange?.(next);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    add(text);
    setText('');
  };

  const pill = { fontFamily: FONT, borderColor: CHALK_RAIL, color: CHALK_CREAM, outlineColor: CHALK_CREAM };
  return (
    <div className="fixed inset-x-0 top-0 z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="sauce-pantry-panel" role="dialog" aria-label="My pantry">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2 gap-2">
        <button type="button" onClick={onClose} data-testid="sauce-pantry-close"
          className={`px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`} style={{ ...pill, fontSize: 18, border: `1px solid ${CHALK_RAIL}` }}>
          ← Back
        </button>
        {onInvent && (
          <button type="button" onClick={onInvent} data-testid="sauce-pantry-invent"
            className={`px-3 py-2 rounded-lg min-h-[44px] ${FOCUS}`} style={{ fontFamily: FONT, fontSize: 18, color: CARD_INK, background: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
            Invent a sauce →
          </button>
        )}
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-4 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>My pantry</h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }}>
          What’s in your kitchen. Shared with Make a recipe; kept on this device only.
        </p>

        <form onSubmit={submit} className="flex gap-2">
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Add an ingredient — e.g. shallot"
            aria-label="Add an ingredient to my pantry" list="sauce-pantry-vocab" data-testid="sauce-pantry-input"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-md focus:outline-none focus-visible:ring-2 text-[17px] min-h-[44px]"
            style={{ fontFamily: FONT, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}
          />
          <datalist id="sauce-pantry-vocab">{vocab.map((v) => <option key={v} value={v} />)}</datalist>
          <button type="submit" data-testid="sauce-pantry-add" className={`px-4 rounded-md min-h-[44px] border ${FOCUS}`} style={pill}>Add</button>
        </form>

        <label className="mt-2 flex items-center gap-2 min-h-[44px] cursor-pointer text-[15px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
          <input type="checkbox" checked={assumeBasics} onChange={(e) => onAssumeBasicsChange?.(e.target.checked)}
            data-testid="sauce-pantry-basics" className="w-5 h-5" style={{ accentColor: CHALK_CREAM }} />
          Assume I have the basics — salt, pepper, oil, butter, sugar, flour
        </label>
        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer text-[15px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
          <input type="checkbox" checked={spiceRack} onChange={(e) => onSpiceRackChange?.(e.target.checked)}
            data-testid="sauce-pantry-spice-rack" className="w-5 h-5" style={{ accentColor: CHALK_CREAM }} />
          Spice rack — cumin, paprika, cinnamon, thyme, oregano, bay, nutmeg…
        </label>

        <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="sauce-pantry-items" aria-label="In my pantry">
          {kitchen.length === 0 && (
            <li className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Your pantry is empty — add what you have, or tap the common ones below.</li>
          )}
          {kitchen.map((k) => (
            <li key={k}>
              <button type="button" onClick={() => onChange?.(removeFromKitchen(kitchen, k))} aria-label={`Remove ${k}`}
                className={`px-3 py-1 rounded-full border min-h-[44px] text-[17px] ${FOCUS}`} style={{ ...pill, background: 'rgba(245,239,222,0.08)' }}>
                {k} <span aria-hidden="true" style={{ color: CHALK_SUB }}>×</span>
              </button>
            </li>
          ))}
        </ul>

        {common.length > 0 && (
          <div className="mt-3">
            <p className="text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Quick add — most used in sauces</p>
            <div className="flex flex-wrap gap-1.5" data-testid="sauce-pantry-quick">
              {common.map((k) => (
                <button key={k} type="button" onClick={() => add(k)} aria-label={`Add ${k}`}
                  className={`px-2.5 py-1 rounded-full border min-h-[44px] text-[15px] ${FOCUS}`} style={{ ...pill, borderStyle: 'dashed', color: CHALK_DIM }}>
                  + {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {kitchen.length > 0 && (
          <>
            <section className="mt-5" data-testid="sauce-pantry-make">
              <h3 className="text-[24px]" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>Sauces you can make ({result.make.length})</h3>
              {result.make.length === 0 && (
                <p className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Nothing complete yet — see what is one or two away.</p>
              )}
              <ul className="flex flex-col">
                {result.make.map((m) => (
                  <SauceRow key={m.item.name} entry={m} familyById={familyById} onSelect={onSelectSauce}>
                    <span className="block text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                      {m.total} ingredient{m.total === 1 ? '' : 's'}, all in your pantry
                    </span>
                  </SauceRow>
                ))}
              </ul>
            </section>

            <section className="mt-4" data-testid="sauce-pantry-nearly">
              <h3 className="text-[24px]" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>One or two away ({result.nearly.length})</h3>
              {result.nearly.length === 0 && (
                <p className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Nothing close yet — add a few more ingredients.</p>
              )}
              <ul className="flex flex-col">
                {result.nearly.slice(0, NEARLY_SHOWN).map((m) => (
                  <SauceRow key={m.item.name} entry={m} familyById={familyById} onSelect={onSelectSauce}>
                    <span className="block text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                      missing {m.missing.join(' and ')}
                      {m.standIn ? ` · or use your ${m.standIn.use} in its place` : ''}
                    </span>
                  </SauceRow>
                ))}
              </ul>
              {result.nearly.length > NEARLY_SHOWN && (
                <p className="text-[12px]" style={{ color: CHALK_SUB }}>…and {result.nearly.length - NEARLY_SHOWN} more.</p>
              )}
            </section>
            <p className="mt-3 text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
              {assumeBasics ? 'Salt, pepper, oil, butter, sugar, flour and water are assumed. ' : ''}
              {spiceRack ? 'Common dried spices are assumed. ' : ''}
              A stand-in is only offered from the same role and kind — lime for lemon, shallot for onion, cream for crème fraîche — never flour for egg yolk.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
