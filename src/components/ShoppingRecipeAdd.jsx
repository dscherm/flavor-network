/**
 * ShoppingRecipeAdd (SHOP-3) — "Add from a recipe" inside the shopping list.
 *
 * One search box over the built-in cocktails, sauces and dishes and the cook's own saved ones, by name.
 * Picking one opens a preview: "You need" (ticked), "Basics" (ticked only with "Include basics"), "You have"
 * (not ticked, with where each was found). The cook's ticks decide what is added ("Add N to the list").
 *
 * What is fetched when the search opens: the three recipe source files only (cocktail_codex_v2.json,
 * sauce_augment.json and the bundled dish list). Never the pairing data, the graph or a model.
 *
 *   list, onChange   the shopping list and useUserProfile.updateShopping (change = list => nextList)
 *   own              { cocktails, sauces, recipes } from the profile
 *   names            the curated ingredient names (Set) once the list screen has them, or null
 *   loadSources      () => Promise<{ cocktails, families, sauces, dishes, dishDetails }>; default: the lazy loader
 *   stock            () => { kitchen, pantry, bar, spiceRack }; default: the device's saved lists
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyList } from '../data/shoppingList.js';
import { usage } from '../data/usageEvents.js';
import { loadUnitSystem } from '../data/shoppingUnits.js';
import {
  KIND_LABEL, askAgainText, addTicked, shopRecipeUsage, buildEntries, classifyLines, loadRecipeSources, makeLocator, resolveEntry, searchEntries, summaryText,
} from '../data/shoppingRecipes.js';
import { loadKitchen, loadSpiceRack } from '../data/myKitchen.js';
import { loadBar } from '../data/myBar.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const buttonStyle = { fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, border: `1.5px solid ${CHALK_DIM}`, background: 'transparent', outlineColor: CHALK_CREAM };
const inputStyle = { fontFamily: SANS, fontSize: 16, color: CHALK_CREAM, background: 'rgba(10,10,10,0.6)', border: `1.5px solid ${CHALK_DIM}`, outlineColor: CHALK_CREAM };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const defaultStock = () => ({ kitchen: loadKitchen(), pantry: [], bar: loadBar(), spiceRack: loadSpiceRack() });

function LineRow({ line, checked, onToggle, muted = false, where = null }) {
  const id = `shop-pv-${line.id.replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <li style={{ borderBottom: `1px solid ${CHALK_RAIL}55` }}>
      <label htmlFor={id} className="flex items-center gap-3 w-full min-h-[44px] py-1 cursor-pointer" style={{ opacity: muted && !checked ? 0.65 : 1 }}>
        <input id={id} type="checkbox" checked={checked} onChange={onToggle} data-testid={`shopping-preview-line-${line.key}`}
          className={`flex-shrink-0 ${FOCUS}`} style={{ width: 24, height: 24, accentColor: CHALK_CREAM, outlineColor: CHALK_CREAM }} />
        <span className="flex-1 min-w-0 break-words" style={{ fontFamily: SANS, fontSize: 16 }}>
          {line.label}
          {line.amount && <span style={{ color: CHALK_DIM, fontSize: 14 }}>{' · '}{line.amount}</span>}
          {where && <span className="block" style={{ color: CHALK_DIM, fontSize: 12 }}>you have it: {where}</span>}
        </span>
      </label>
    </li>
  );
}

export default function ShoppingRecipeAdd({ list, onChange, own = null, names = null, loadSources = loadRecipeSources, stock = defaultStock }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState({ status: 'idle', data: null });
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState(null); // { entry, recipe, groups, ticks:Set, basics:boolean }
  const [ask, setAsk] = useState(false);
  const [summary, setSummary] = useState('');
  const searchRef = useRef(null);
  const previewRef = useRef(null);
  const cancelRef = useRef(null);
  const toggleRef = useRef(null);
  const current = list || emptyList();

  const started = useRef(false);
  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    setSources({ status: 'loading', data: null });
    loadSources()
      .then((data) => setSources({ status: 'ready', data }))
      .catch(() => { started.current = false; setSources({ status: 'failed', data: null }); });
  }, [open, loadSources]);

  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useEffect(() => { if (pick) previewRef.current?.focus(); }, [pick?.entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const entries = useMemo(() => buildEntries({ data: sources.data, own }), [sources.data, own]);
  const results = useMemo(() => searchEntries(query, entries, 8), [query, entries]);

  const openPreview = (entry) => {
    const recipe = resolveEntry(entry, sources.data);
    if (!recipe) { setSummary(`Could not open ${entry.name}.`); return; }
    const locate = makeLocator({ ...stock(), names });
    const groups = classifyLines(recipe, locate, names);
    setSummary('');
    setAsk(false);
    setPick({ entry, recipe, groups, ticks: new Set(groups.need.map((l) => l.id)), basics: false });
  };

  const closePreview = () => {
    setPick(null);
    setAsk(false);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const toggleLine = (id) => setPick((p) => {
    const ticks = new Set(p.ticks);
    if (ticks.has(id)) ticks.delete(id); else ticks.add(id);
    return { ...p, ticks };
  });

  const toggleBasics = () => setPick((p) => {
    const on = !p.basics;
    const ticks = new Set(p.ticks);
    for (const l of p.groups.basics) { if (on) ticks.add(l.id); else ticks.delete(l.id); }
    return { ...p, basics: on, ticks };
  });

  const ticked = pick ? pick.groups.all.filter((l) => pick.ticks.has(l.id)) : [];

  const commit = (lines, force) => {
    const { recipe, groups } = pick;
    const res = addTicked(current, recipe, lines, { force, names });
    onChange((cur) => addTicked(cur || emptyList(), recipe, lines, { force, names }).list);
    const ev = shopRecipeUsage(recipe, 'list', res.summary);
    if (ev) usage.shopRecipeAdded(ev);
    setSummary(summaryText(recipe.name, res.summary, { left: groups.have.filter((l) => !lines.some((x) => x.id === l.id)).length, system: loadUnitSystem() }));
    setPick(null);
    setAsk(false);
    setQuery('');
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const addNow = (lines) => {
    if (!lines.length) return;
    const res = addTicked(current, pick.recipe, lines, { force: false, names });
    if (res.summary.alreadyOnList) {
      setAsk(true);
      setTimeout(() => cancelRef.current?.focus(), 0);
      return;
    }
    commit(lines, false);
  };

  const everything = pick && pick.groups.need.length === 0;

  return (
    <div className="mt-3" data-testid="shopping-recipe-add">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => { setOpen((v) => !v); if (open) { setPick(null); setAsk(false); setSources((s) => (s.status === 'failed' ? { status: 'idle', data: null } : s)); } }}
        aria-expanded={open}
        aria-controls="shopping-recipe-panel"
        data-testid="shopping-recipe-toggle"
        className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`}
        style={{ ...buttonStyle, fontWeight: 600 }}
      >
        {open ? 'Close recipe search' : 'Add from a recipe'}
      </button>

      {open && (
        <div id="shopping-recipe-panel" className="mt-2 rounded-xl p-3" style={{ border: `1.5px solid ${CHALK_RAIL}` }}>
          <label htmlFor="shopping-recipe-search" style={{ fontFamily: SANS, fontSize: 13, color: CHALK_DIM }}>Search cocktails, sauces and dishes by name</label>
          <input
            id="shopping-recipe-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            placeholder="Negroni, Bolognese, hollandaise…"
            data-testid="shopping-recipe-search"
            className={`w-full min-h-[44px] rounded-lg px-3 mt-1 ${FOCUS}`}
            style={inputStyle}
          />
          {sources.status === 'loading' && <p style={{ fontFamily: SANS, fontSize: 13, color: CHALK_SUB, marginTop: 6 }}>Loading the recipes…</p>}
          {sources.status === 'failed' && (
            <p role="alert" style={{ fontFamily: SANS, fontSize: 13, color: CHALK_CREAM, marginTop: 6 }}>
              The built-in recipes could not be loaded just now, so only your own saved recipes are searchable. Close this and open it again to retry, or add items by hand above.
            </p>
          )}

          {!pick && query.trim() && sources.status !== 'loading' && (
            results.length > 0 ? (
              <ul data-testid="shopping-recipe-results" aria-label="Recipes found" className="mt-2">
                {results.map((e) => (
                  <li key={e.id} style={{ borderBottom: `1px solid ${CHALK_RAIL}55` }}>
                    <button type="button" onClick={() => openPreview(e)} data-testid={`shopping-recipe-result-${e.id}`}
                      className={`w-full text-left min-h-[44px] py-1 flex items-baseline gap-2 ${FOCUS}`} style={{ color: CHALK_CREAM, outlineColor: CHALK_CREAM }}>
                      <span className="flex-1 min-w-0 break-words" style={{ fontFamily: SANS, fontSize: 16 }}>{e.name}</span>
                      <span style={{ fontFamily: SANS, fontSize: 12, color: CHALK_DIM }}>{e.origin === 'own' ? `Your ${KIND_LABEL[e.kind].toLowerCase()}` : KIND_LABEL[e.kind]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="shopping-recipe-none" style={{ fontFamily: SANS, fontSize: 13, color: CHALK_DIM, marginTop: 6 }}>No recipe has that name.</p>
            )
          )}
          {!pick && !query.trim() && sources.status === 'ready' && (
            <p style={{ fontFamily: SANS, fontSize: 13, color: CHALK_SUB, marginTop: 6 }}>Type a name. It adds only what you do not already have.</p>
          )}

          {pick && (
            <section
              aria-labelledby="shopping-preview-title"
              data-testid="shopping-recipe-preview"
              className="mt-3"
              onKeyDown={(e) => { if (e.key === 'Escape') { if (ask) setAsk(false); else closePreview(); } }}
            >
              <h2 id="shopping-preview-title" ref={previewRef} tabIndex={-1} style={{ fontFamily: FONT, fontSize: 26, outline: 'none' }}>
                {pick.recipe.name}
                <span style={{ fontFamily: SANS, fontSize: 12, color: CHALK_DIM }}>{' '}{pick.entry.origin === 'own' ? `your ${KIND_LABEL[pick.entry.kind].toLowerCase()}` : KIND_LABEL[pick.entry.kind].toLowerCase()}</span>
              </h2>

              {everything ? (
                <p data-testid="shopping-preview-everything" style={{ fontFamily: SANS, fontSize: 15, marginTop: 4 }}>You have everything for this.</p>
              ) : (
                <>
                  <h3 style={{ fontFamily: FONT, fontSize: 20, color: CHALK_DIM, marginTop: 8 }}>You need</h3>
                  <ul data-testid="shopping-preview-need" aria-label="You need">
                    {pick.groups.need.map((l) => <LineRow key={l.id} line={l} checked={pick.ticks.has(l.id)} onToggle={() => toggleLine(l.id)} />)}
                  </ul>
                </>
              )}

              {pick.groups.basics.length > 0 && (
                <div className="mt-2">
                  <label className="flex items-center gap-3 min-h-[44px] cursor-pointer" style={{ fontFamily: SANS, fontSize: 15 }}>
                    <input type="checkbox" checked={pick.basics} onChange={toggleBasics} data-testid="shopping-preview-basics"
                      className={`flex-shrink-0 ${FOCUS}`} style={{ width: 24, height: 24, accentColor: CHALK_CREAM, outlineColor: CHALK_CREAM }} />
                    <span>Include basics <span style={{ color: CHALK_DIM, fontSize: 13 }}>({pick.groups.basics.map((l) => l.label).join(', ')})</span></span>
                  </label>
                  {pick.basics && (
                    <ul data-testid="shopping-preview-basics-list" aria-label="Basics">
                      {pick.groups.basics.map((l) => <LineRow key={l.id} line={l} checked={pick.ticks.has(l.id)} onToggle={() => toggleLine(l.id)} />)}
                    </ul>
                  )}
                </div>
              )}

              {pick.groups.have.length > 0 && (
                <>
                  <h3 style={{ fontFamily: FONT, fontSize: 20, color: CHALK_DIM, marginTop: 8 }}>You have</h3>
                  <ul data-testid="shopping-preview-have" aria-label="You have">
                    {pick.groups.have.map((l) => <LineRow key={l.id} line={l} checked={pick.ticks.has(l.id)} onToggle={() => toggleLine(l.id)} muted where={l.where} />)}
                  </ul>
                </>
              )}

              {ask && (
                <div role="alertdialog" aria-labelledby="shopping-preview-ask" data-testid="shopping-preview-ask"
                  className="mt-3 rounded-xl p-3" style={{ border: `2px solid ${CHALK_CREAM}`, background: 'rgba(10,10,10,0.8)' }}>
                  <p id="shopping-preview-ask" style={{ fontFamily: SANS, fontSize: 14 }}>{askAgainText(pick.recipe.name)}</p>
                  <div className="mt-2 flex gap-2">
                    <button ref={cancelRef} type="button" onClick={() => setAsk(false)} data-testid="shopping-preview-ask-cancel" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={{ ...buttonStyle, fontWeight: 600 }}>Cancel</button>
                    <button type="button" onClick={() => commit(ticked, true)} data-testid="shopping-preview-ask-yes" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={buttonStyle}>Add it again</button>
                  </div>
                </div>
              )}

              {!ask && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={ticked.length === 0} onClick={() => addNow(ticked)} data-testid="shopping-preview-add"
                    className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={{ ...buttonStyle, fontWeight: 600, opacity: ticked.length === 0 ? 0.5 : 1 }}>
                    {ticked.length === 0 ? 'Nothing ticked' : `Add ${ticked.length} to the list`}
                  </button>
                  {everything && pick.groups.have.length > 0 && (
                    <button type="button" onClick={() => addNow(pick.groups.all.filter((l) => pick.groups.have.some((h) => h.id === l.id) || (pick.basics && pick.groups.basics.some((b) => b.id === l.id))))} data-testid="shopping-preview-add-anyway"
                      className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={buttonStyle}>
                      Add it all anyway
                    </button>
                  )}
                  <button type="button" onClick={closePreview} data-testid="shopping-preview-close" className={`min-h-[44px] px-4 rounded-lg ${FOCUS}`} style={buttonStyle}>Back to search</button>
                </div>
              )}
              <p style={{ fontFamily: SANS, fontSize: 12, color: CHALK_SUB, marginTop: 6 }}>
                {plural(pick.groups.have.length, 'ingredient', 'ingredients')} found in what you have; tick one to add it anyway.
              </p>
            </section>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" data-testid="shopping-recipe-summary" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_CREAM, marginTop: 8, minHeight: 20 }}>{summary}</p>
    </div>
  );
}
