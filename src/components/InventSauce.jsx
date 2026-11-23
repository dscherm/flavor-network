/**
 * InventSauce — "Invent a sauce" for the Sauce Lab. The cook chooses everything:
 * the panel never adds an ingredient or a name on its own.
 *
 *  1. "What is the sauce built on?" (InventStart): pantry items that can anchor a
 *     sauce first, common anchors next, a text box. Nothing else shows until it
 *     is answered; the list then holds ONLY that ingredient.
 *  2. Optional "What is it for?" (a protein), "A particular technique? (optional)"
 *     (the 10 INVENT_STYLES), the list (add by typing, remove, editable suggested
 *     amounts, stand-ins from the pantry for what the cook lacks), a recommended
 *     technique (applied only on Accept), a checklist of what the technique needs
 *     (required parts carry a one-line why; nothing is added without a tap),
 *     suggestions, the flavor profile, and — only once a technique is chosen or
 *     accepted — method, wine with the protein and the closest existing sauce.
 *  3. The cook names it and saves it through `onSave`.
 *
 * Props: kitchen, assumeBasics, sauces, families, meta, catMap, names, pairingIndex,
 * sauceIndex, categoryOf, seed, wineStyles, nodes (Map name → { taste } | null),
 * onSave(input) → Promise<{ status: 'saved'|'signin'|'error', message? }>,
 * editItem { id, name, baseline: { category, protein? }, lines }, onClose,
 * onSelectSauce, onOpenRecipeLab.
 *
 * onSave input (the argument of inventSaved.toSavedItem):
 *   { kind: 'sauce', id?, name, category: styleId|null, lines: [{ key, amount, role }], method?, protein? }
 * No onSave → no name / save row.
 *
 * `seed` = { styleId?, fromName?, protein?, pinned?: [{ key, source: 'search' }] }:
 * the pinned keys open as the list (source 'search'; the first one that can anchor
 * a sauce goes first), `protein` answers "what is it for", and `styleId` is applied
 * only when `fromName` (the search named a sauce); otherwise the technique is
 * recommended from the list like any other.
 *
 * Test ids: sauce-invent, -close, -source, -pantry-only, -proteins, -notebook,
 * -restart, -card, -vessel, -technique, -method, -why, -honest, -shopping, -wine,
 * -nearest; and the shared pieces under the prefixes sauce-invent-start (-option,
 * -input, -go), -category (-toggle, -option-{id}, -none), -list (-line, -amount-{key},
 * -remove-{key}, -need-{key}, -replacements-{key}, -replace-option, -add-input, -add,
 * -notice), -hint (-accept, -dismiss), -checklist (-item-{slot}, -open-{slot},
 * -why-{slot}, -options-{slot}, -option), -suggest (-item), -profile (-bar-{axis},
 * -summary, -uncounted), -namesave (-name, -save, -status).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  INVENT_STYLES, INVENT_STYLE_BY_ID, sauceSkeleton, rankSauceSlot, sauceFromBuild, haveSauceKey, buildSaucePool,
  proteinVocabulary, amountFor, canAnchorSauce, sauceAnchors, sauceReplacements,
} from '../data/inventSauce.js';
import {
  openBuild, applyCategory, clearCategory, addLine, removeLine, replaceLine, setSlot, checklist, shortlist,
  suggestNext, recommendCategory, buildKeys, hasCategory,
} from '../data/inventBuild.js';
import { buildFlavorProfile } from '../data/inventProfile.js';
import { toSavedItem } from '../data/inventSaved.js';
import { sauceRoleOf } from '../data/saucePantry.js';
import { kitchenKey } from '../data/myKitchen.js';
import { nearestSauces } from '../data/sauceSimilarity.js';
import { winesForSauce, proteinIngredient } from '../data/sauceWines.js';
import { loadWineStyles, familyColor } from '../data/wineStyles.js';
import { TEXT, HAND, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { SauceVessel } from './sauceVessels.jsx';
import { WineGlass } from './wineGlasses.jsx';
import InventStart from './InventStart.jsx';
import InventList from './InventList.jsx';
import { IngredientBuilderScope } from './IngredientCardProvider.jsx';
import InventChecklist from './InventChecklist.jsx';
import InventSuggestions from './InventSuggestions.jsx';
import InventDeck from './InventDeck.jsx';
import InventCategoryHint from './InventCategoryHint.jsx';
import InventCategoryPicker from './InventCategoryPicker.jsx';
import InventFlavorProfile from './InventFlavorProfile.jsx';
import InventNameSave from './InventNameSave.jsx';
import HelpBubble from './HelpBubble.jsx';
import { useInventUsage } from '../hooks/useUsage.js';
import { noteTypedIngredient } from '../data/usageIngredient.js';

import { textAction, FOCUS, ACCENT } from './inventUi.jsx';
import { ChevronLeft, chalkRule } from './ChalkIcons.jsx';
import { CONTROL_RADIUS } from '../data/chalkTheme.js';
const PROTEINS_SHOWN = 12;
const NEED = 'you’d need';
const P = 'sauce-invent';

const normKey = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const article = (word) => (/^[aeiou]/i.test(word) ? 'An' : 'A');

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
  seed = null,
  wineStyles = undefined, // injectable for tests; undefined → lazy-load
  nodes = null,
  onSave,
  editItem = null,
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
  const vocab = useMemo(() => [...new Set([...(names ? [...names] : []), ...pool.keys()])], [names, pool]);
  const skeletons = useMemo(() => INVENT_STYLES.map((s) => ({ id: s.id, skeleton: sauceSkeleton(s.id, { catMap: cats }) })), [cats]);
  const anchors = useMemo(
    () => sauceAnchors({ kitchen, assumeBasics, names, pool, catMap: cats }),
    [kitchen, assumeBasics, names, pool, cats],
  );

  const toKey = (text) => kitchenKey(text, names || undefined);
  const haveOf = (key) => haveSauceKey(key, { kitchen, assumeBasics, names });
  const skeletonFor = (id) => sauceSkeleton(id, { catMap: cats });

  // The state the panel opens in: empty, a saved sauce, or a search seed.
  const [init] = useState(() => {
    if (editItem && Array.isArray(editItem.lines)) {
      let b = openBuild({ lab: 'sauce', lines: editItem.lines.map((l) => ({ key: l.key, source: 'user' })) });
      const cat = editItem.baseline?.category;
      const styleId = INVENT_STYLE_BY_ID.has(cat) ? cat : null;
      if (styleId) b = applyCategory(b, sauceSkeleton(styleId, { catMap: cats }));
      const edits = {};
      for (const l of editItem.lines) if (l.amount) edits[l.key] = l.amount;
      return { build: b, styleId, protein: editItem.baseline?.protein || null, edits, name: editItem.name || '' };
    }
    const pinned = (seed?.pinned || []).map((p) => p.key).filter(Boolean);
    const first = pinned.find((k) => canAnchorSauce(k, cats));
    const ordered = first ? [first, ...pinned.filter((k) => k !== first)] : pinned;
    let b = openBuild({ lab: 'sauce', lines: ordered.map((k) => ({ key: k, source: 'search' })) });
    const styleId = ordered.length && seed?.fromName && INVENT_STYLE_BY_ID.has(seed?.styleId) ? seed.styleId : null;
    if (styleId) b = applyCategory(b, sauceSkeleton(styleId, { catMap: cats }));
    return { build: b, styleId, protein: seed?.protein || null, edits: {}, name: '' };
  });

  const [build, setBuild] = useState(init.build);
  const [styleId, setStyleId] = useState(init.styleId);
  const [protein, setProtein] = useState(init.protein);
  const [edits, setEdits] = useState(init.edits);
  const [name, setName] = useState(init.name);
  const [pantryOnly, setPantryOnly] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openPart, setOpenPart] = useState(null);
  const [dismissedFor, setDismissedFor] = useState(null);
  const [deck, setDeck] = useState(null); // BUILDER-1: null | { mode: 'add' | 'replace', ingredient?, candidates }
  const [notice, setNotice] = useState(() => (init.build.rejected.length ? init.build.rejected.map((r) => r.reason).join(' ') : null));
  const [save, setSave] = useState({ status: 'idle', message: '' });
  // PICTURE-4: undefined = untouched (an edited sauce keeps its own); null = none; else the chooser's value.
  const [picture, setPicture] = useState(undefined);

  const keys = buildKeys(build);
  const keysId = keys.join('|');
  const answered = keys.length > 0;
  const style = styleId ? INVENT_STYLE_BY_ID.get(styleId) : null;
  const invent = useInventUsage('sauce', { started: answered, categoryId: styleId, editing: !!editItem });

  useEffect(() => { setSave((s) => (s.status === 'saved' || s.status === 'error' ? { status: 'idle', message: '' } : s)); }, [keysId, name, styleId]);

  const [styles, setStyles] = useState(wineStyles ?? null);
  useEffect(() => {
    if (wineStyles !== undefined || !protein || !style || styles) return undefined;
    let cancelled = false;
    loadWineStyles(import.meta.env.BASE_URL).then((d) => { if (!cancelled && d) setStyles(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [protein, style, styles, wineStyles]);

  const sauce = useMemo(
    () => (styleId ? sauceFromBuild(build, { styleId, protein, catMap: cats, pairingIndex, sauceIndex, kitchen, assumeBasics, names }) : null),
    [build, styleId, protein, cats, pairingIndex, sauceIndex, kitchen, assumeBasics, names],
  );
  const suggestedAmount = (key) => {
    const fromSauce = sauce?.lines.find((l) => l.key === key)?.amount;
    return fromSauce ?? amountFor(key, { required: false }, null, cats);
  };
  const amountOf = (key) => edits[key] ?? suggestedAmount(key);

  const nearest = useMemo(() => (sauce && keys.length ? nearestSauces(keys, sauces, 1) : []), [sauce, keysId, sauces]); // eslint-disable-line react-hooks/exhaustive-deps
  const wine = useMemo(() => (sauce && protein && styles?.wines && keys.length
    ? winesForSauce({ ingredients: keys, proteins: [protein] }, styles.wines, { categoryOf: categoryOf || undefined })[0] || null
    : null), [sauce, protein, styles, keysId, categoryOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const profileAmounts = Object.fromEntries(keys.map((k) => [k, amountOf(k)]));
  const amountSig = keys.map((k) => `${k}=${profileAmounts[k]}`).join('|');
  const profile = useMemo(() => buildFlavorProfile(keys, nodes, { noun: 'sauce', amounts: profileAmounts }), [amountSig, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const rankArgs = { protein, kitchen, assumeBasics, pantryOnly, pool, catMap: cats, pairingIndex, sauceIndex, names };
  const rec = !styleId && dismissedFor !== keysId ? recommendCategory(keys, skeletons) : null;
  const recStyle = rec ? INVENT_STYLE_BY_ID.get(rec.id) : null;
  const suggestions = answered
    ? suggestNext(build, ({ slot, currentKeys }) => rankSauceSlot({ slot, currentKeys, ...rankArgs }), 8)
      .map((c) => ({ key: c.key, have: !!c.have, note: c.have ? undefined : NEED }))
    : [];

  const lineViews = [...build.slots.filter((s) => s.line).map((s) => s.line), ...build.extras]
    .map((l) => ({ key: l.key, source: l.source, have: haveOf(l.key), amount: amountOf(l.key) }));
  const savedLines = lineViews.map((l) => ({ key: l.key, amount: l.amount, role: sauceRoleOf(l.key, cats) }));
  const savePreview = toSavedItem({ kind: 'sauce', name, category: styleId, lines: savedLines });

  // ── actions ──
  const changed = (next) => { setBuild(next); setNotice(null); };
  const add = (text) => {
    const k = toKey(text);
    if (!k) return false;
    noteTypedIngredient('sauce', text, names);
    const r = addLine(build, k, {});
    if (!r.ok) { setNotice(r.reason); return false; }
    changed(r.build);
    return true;
  };
  const answerStart = (text) => {
    const k = toKey(text);
    if (!k) return;
    noteTypedIngredient('sauce', text, names);
    setBuild(openBuild({ lab: 'sauce', lines: [{ key: k, source: 'user' }] }));
    setStyleId(null);
    setNotice(null);
  };
  const remove = (k) => {
    setEdits((e) => { const { [k]: _gone, ...rest } = e; return rest; });
    changed(removeLine(build, k));
  };
  const replace = (oldKey, newKey) => {
    const r = replaceLine(build, oldKey, newKey, {});
    if (!r.ok) { setNotice(r.reason); return; }
    setEdits((e) => { const { [oldKey]: _gone, ...rest } = e; return rest; });
    changed(r.build);
  };
  const pickStyle = (id) => {
    setStyleId(id);
    setOpenPart(null);
    setBuild(id == null ? clearCategory(build) : applyCategory(build, skeletonFor(id)));
    setNotice(null);
  };
  const slotOf = (key) => build.slots.find((s) => s.line && s.line.key === key) || null;
  const replacementsFor = (key) => sauceReplacements(key, {
    slot: slotOf(key), buildKeys: keys, kitchen, assumeBasics, names, catMap: cats,
  });
  const optionsFor = (slotId) => shortlist(build, slotId, (slot, currentKeys) => rankSauceSlot({ slot, currentKeys, ...rankArgs }), 8)
    .map((c) => ({ key: c.key, have: !!c.have, note: c.have ? undefined : NEED }));
  const pickPart = (slotId, key) => {
    const r = setSlot(build, slotId, key, {});
    if (!r.ok) { setNotice(r.reason); return; }
    setOpenPart(null);
    changed(r.build);
  };
  const startOver = () => {
    setBuild(openBuild({ lab: 'sauce' }));
    setStyleId(null); setProtein(null); setEdits({}); setName(''); setPantryOnly(false);
    setPickerOpen(false); setOpenPart(null); setDismissedFor(null); setNotice(null); setSave({ status: 'idle', message: '' }); setPicture(undefined);
  };
  const [lastSaved, setLastSaved] = useState(null);
  const doSave = async () => {
    const input = {
      kind: 'sauce', ...(editItem?.id ? { id: editItem.id } : {}), name: name.trim(), category: styleId || null, lines: savedLines,
      ...(sauce?.method ? { method: sauce.method } : {}), ...(protein ? { protein } : {}),
      ...(picture !== undefined ? { picture } : {}),
    };
    setSave({ status: 'saving', message: '' });
    try {
      const res = await onSave(input);
      setSave({ status: res?.status || 'saved', message: res?.message || '', pictureReason: res?.pictureReason || '' });
      if ((res?.status || 'saved') === 'saved') setLastSaved(picture === undefined && editItem?.picture ? { ...input, picture: editItem.picture } : input);
    } catch (err) {
      setSave({ status: 'error', message: err?.message || 'Could not save.' });
    }
  };

  const family = style ? familyById.get(style.familyId) : null;
  const color = family?.color || CHALK_DIM;
  const chip = (active) => ({
    fontFamily: TEXT,
    color: CHALK_CREAM,
    background: 'transparent',
    border: `${active ? '1.5px' : '1px'} solid ${active ? ACCENT : CHALK_RAIL}`,
    borderRadius: CONTROL_RADIUS,
  });
  const actionBtn = textAction({ fontSize: 18 });
  const sub = (txt) => <p className="text-[13px] mb-1" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{txt}</p>;

  return (
    <IngredientBuilderScope onAdd={(k) => { add(k); }} has={(k) => lineViews.some((l) => l.key === k)} addLabel="Add to this sauce">
    <div className="fixed inset-x-0 top-0 safe-top-pad z-[82] flex flex-col items-center px-4 py-3 overflow-y-auto overflow-x-hidden"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid={P} role="dialog" aria-label="Invent a sauce">
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2">
        <button type="button" onClick={onClose} data-testid={`${P}-close`}
          className={`min-h-[44px] inline-flex items-center gap-1 min-w-[44px] ${FOCUS}`} style={{ ...textAction({ fontSize: 18 }), textDecoration: 'none' }}>
          <ChevronLeft size={20} />Back
        </button>
      </div>

      <div className="w-full max-w-[560px] min-w-0 py-4 flex flex-col gap-6">
        <div>
          <div className="flex items-center justify-center gap-1">
            <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: HAND, textShadow: CHALK_SHADOW }}>Invent a sauce</h2>
            <HelpBubble variant="chalk" label="How this works" testId={`${P}-source-help`}
              body={kitchen.length
                ? `From your pantry (${kitchen.length} item${kitchen.length === 1 ? '' : 's'}) first.`
                : 'Your pantry is empty, so this draws on every ingredient in the sauce list.'} />
          </div>
        </div>

        {!answered && (
          <InventStart question="What is the sauce built on?" options={anchors} onPick={answerStart}
            placeholder="or type the main ingredient" testidPrefix={`${P}-start`} />
        )}

        {answered && (
          <>
            {proteins.length > 0 && (
              <div>
                {sub('What is it for? (optional)')}
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="What is it for" data-testid={`${P}-proteins`}>
                  <button type="button" aria-pressed={protein == null} onClick={() => setProtein(null)}
                    className={`px-3 py-1 min-h-[44px] text-[16px] ${FOCUS}`} style={chip(protein == null)}>nothing in particular</button>
                  {proteins.map((p) => (
                    <button key={p} type="button" aria-pressed={protein === p} onClick={() => setProtein(p)}
                      className={`px-3 py-1 min-h-[44px] text-[16px] ${FOCUS}`} style={chip(protein === p)}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            <InventCategoryPicker title="A particular technique? (optional)" testidPrefix={`${P}-category`}
              options={INVENT_STYLES.map((s) => ({
                id: s.id, label: s.label, blurb: s.blurb,
                art: <SauceVessel familyName={familyById.get(s.familyId)?.name || s.id} color={familyById.get(s.familyId)?.color || CHALK_DIM} size={26} />,
              }))}
              value={styleId} onChange={pickStyle} open={pickerOpen} onToggle={() => setPickerOpen((o) => !o)}
              labels={{ none: 'No particular technique', noneBlurb: 'Choose your own ingredients; we suggest as you go.' }} />

            <label className="flex items-center gap-2 min-h-[44px] min-w-[44px] cursor-pointer text-[15px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
              <input type="checkbox" checked={pantryOnly} onChange={(e) => setPantryOnly(e.target.checked)}
                data-testid={`${P}-pantry-only`} className="w-5 h-5" style={{ accentColor: CHALK_CREAM }} />
              Only what I have (no shopping)
            </label>

            <InventList testidPrefix={`${P}-list`} lines={lineViews} vocab={vocab} notice={notice}
              onAdd={add} onRemove={remove}
              onAmount={(k, t) => setEdits((e) => ({ ...e, [k]: t }))}
              replacementsFor={replacementsFor} onReplace={replace}
              onReplaceDeck={(k, cands) => setDeck({ mode: 'replace', ingredient: k, candidates: cands })} />

            {rec && recStyle && (
              <InventCategoryHint testidPrefix={`${P}-hint`} label={recStyle.label} blurb={recStyle.blurb}
                labels={{ lead: `This looks like ${/^[aeiou]/i.test(recStyle.label) ? 'an' : 'a'}` }}
                onAccept={() => pickStyle(rec.id)} onDismiss={() => setDismissedFor(keysId)} />
            )}

            {style && hasCategory(build) && (
              <InventChecklist testidPrefix={`${P}-checklist`} title={`${article(style.label)} ${style.label} needs`}
                items={checklist(build)} openId={openPart}
                onOpen={(id) => setOpenPart((o) => (o === id ? null : id))}
                optionsFor={optionsFor} onPick={pickPart} />
            )}

            <InventSuggestions testidPrefix={`${P}-suggest`} title="Goes well with what you have" items={suggestions} onAdd={add}
              onDeck={() => setDeck({ mode: 'add', candidates: suggestions.map((x) => x.key) })} />

            <InventFlavorProfile testidPrefix={`${P}-profile`} title="Flavor profile" profile={profile} />

            {sauce && style && (
              <article data-testid={`${P}-card`}>
                <div className="mb-4" style={{ color: CHALK_RAIL, lineHeight: 0 }} aria-hidden="true">{chalkRule()}</div>
                <div className="flex items-center gap-3 mb-2">
                  <SauceVessel familyName={family?.name || ''} color={color} size={56} testid={`${P}-vessel`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[24px] leading-tight" style={{ fontFamily: HAND, textShadow: CHALK_SHADOW }} data-testid={`${P}-technique`}>{style.label}</h3>
                    <p className="text-[12px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
                      {sauce.description}{protein ? `, for ${protein}` : ''}
                    </p>
                  </div>
                </div>

                {sauce.need.length > 0 && (
                  <p className="mb-2 text-[13px]" style={{ fontFamily: TEXT, color: CHALK_DIM }} data-testid={`${P}-shopping`}>
                    You’d need: {sauce.need.join(', ')}.
                  </p>
                )}

                <h4 className="text-[22px]" style={{ fontFamily: HAND, fontWeight: 400, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Method</h4>
                <p className="text-[13px] mb-1" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{sauce.technique}</p>
                <p className="text-[14px] leading-snug" style={{ fontFamily: TEXT, color: CHALK_CREAM }} data-testid={`${P}-method`}>
                  {sauce.method || 'Add the parts it still needs to see the method.'}
                </p>
                <p className="mt-2 text-[13px]" style={{ fontFamily: TEXT, color: CHALK_DIM }} data-testid={`${P}-why`}>{sauce.why}</p>
                <p className="mt-1 text-[11px]" style={{ fontFamily: TEXT, color: CHALK_SUB }} data-testid={`${P}-honest`}>
                  An idea from what pairs, not a tested recipe — taste and adjust.
                </p>

                {wine && (
                  <div className="mt-3 flex items-center gap-2.5" data-testid={`${P}-wine`}>
                    <WineGlass family={wine.wine.family} color={familyColor(styles?.families, wine.wine.family)} size={36} />
                    <div className="min-w-0">
                      <div className="text-[18px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>{wine.wine.name}</div>
                      <div className="text-[15px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>With {protein}</div>
                      {wine.reason ? <div className="text-[13px]" style={{ fontFamily: TEXT, color: CHALK_SUB }}>{wine.reason}</div> : null}
                    </div>
                  </div>
                )}

                {nearest.length > 0 && (
                  <div className="mt-3" data-testid={`${P}-nearest`}>
                    <p className="text-[13px] mb-1" style={{ fontFamily: TEXT, color: CHALK_SUB }}>Closest sauce on the menu</p>
                    {nearest.map((x) => {
                      const fam = familyById.get(x.sauce.family_id);
                      return (
                        <button key={x.sauce.name} type="button" onClick={() => onSelectSauce?.(x.sauce.name)}
                          className={`w-full text-left flex items-center gap-2 py-0.5 min-h-[44px] ${FOCUS}`}>
                          <SauceVessel familyName={fam?.name || ''} color={fam?.color || CHALK_DIM} size={30} />
                          <span className="text-[19px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>{x.sauce.name}</span>
                          <span className="text-[12px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{Math.round(x.similarity * 100)}% alike</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            )}

            {onSave && (
              <InventNameSave testidPrefix={`${P}-namesave`} name={name} onName={setName} onNameCommit={invent.named} placeholder="Name your sauce"
                canSave={savePreview.ok} disabledReason={savePreview.ok ? '' : savePreview.reason}
                saveLabel="Add to my sauces" status={save.status} message={save.message} onSave={doSave}
                pictureField={{ kind: 'sauce', value: picture, onChange: setPicture, item: editItem }} pictureNote={save.pictureReason}
                shareItem={lastSaved ? { kind: 'sauce', item: lastSaved } : null} />
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-0" role="group" aria-label="More things to do with it">
              <button type="button" onClick={startOver} data-testid={`${P}-restart`}
                className={`min-h-[44px] ${FOCUS}`} style={actionBtn}>
                Start over
              </button>
              {onOpenRecipeLab && (
                <button type="button" data-testid={`${P}-notebook`}
                  onClick={() => onOpenRecipeLab([...keys, ...(protein ? [proteinIngredient(protein)] : [])])}
                  className={`min-h-[44px] ${FOCUS}`} style={actionBtn}>
                  Open in the Recipe Notebook
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {deck && (
        <InventDeck mode={deck.mode} ingredient={deck.ingredient} keys={keys} amounts={profileAmounts} nodes={nodes} candidates={deck.candidates}
          onAdd={add} onSwap={replace} onClose={() => setDeck(null)} />
      )}
    </div>
    </IngredientBuilderScope>
  );
}
