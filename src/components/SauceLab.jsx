import { useState, useEffect, useMemo, useRef } from 'react';
import LabNodeCard from './LabNodeCard.jsx';
import SauceBrowse from './SauceBrowse.jsx';
import {
  loadSauceCodex,
  computeSauceCodexPositions,
} from '../data/sauceCodex.js';
import SauceSuggestionDeck from './SauceSuggestionDeck.jsx';
import { ChalkLoader } from './chalkArt.jsx';
import SaucePairings from './SaucePairings.jsx';
import SaucePantryPanel from './SaucePantryPanel.jsx';
import InventSauce from './InventSauce.jsx';
import { sauceSeedFromSearch } from '../data/inventSearch.js';
import { loadKitchen, saveKitchen, loadAssumeBasics, saveAssumeBasics, loadSpiceRack, saveSpiceRack, addToKitchen } from '../data/myKitchen.js';
import WhatDoINeed from './WhatDoINeed.jsx';
import DishStory from './DishStory.jsx';
import { needsFromKitchen } from '../data/whatDoINeed.js';
import { buildCategoryMap } from '../data/saucePantry.js';
import { buildPairingIndex } from '../data/recipePairingMatch.js';
import { blendIndex } from '../data/everydayPairs.js';
import useEverydayPairs from '../hooks/useEverydayPairs.js';
import { readSaved, withSavedSauces } from '../data/savedInventions.js';
import { fromSavedItem } from '../data/inventSaved.js';
import useSaveInvention from '../hooks/useSaveInvention.js';
import InventSaveOverlay from './InventSaveOverlay.jsx';
import SavedDeleteConfirm from './SavedDeleteConfirm.jsx';

/**
 * SauceLab — Codex view (post-redesign). Each NODE is a sauce,
 * grouped into the 10 mother-sauce families:
 *   Béchamel, Velouté, Espagnole, Hollandaise, Tomato (French),
 *   Curry, Stir-fry, Mole, Salsa, Nut Sauce (global).
 *
 * Click a sauce → detail panel with two tabs (Ingredients with
 * technique, Similar sauces by Jaccard) plus an "Open in Recipe Lab"
 * button that hands the ingredients off in Sauce mode.
 *
 * Mirror of CocktailLab.jsx — replaces the previous ingredient-graph
 * + Sauce Builder + Browse/Saved/Lookup panel that lived here.
 */
export default function SauceLab({
  // Ingredient graph (carries gnnProbs) — used to compute matched sauces'
  // single-series flavor radars in the matches card deck.
  fullData = null,
  onSelectionChange,
  onOpenRecipeLab,
  // Phase 5 bridge: Build path → Sauce Lab. Shape:
  //   { family?: string, cuisine?: string }
  // Pre-selects filter pills on mount. Optional; null = no pre-filter.
  externalFilter = null,
  // P7: aroma-match context from RecipeLab. When non-null, renders
  // only the matched sauces instead of the full browse view.
  // Shape: { recipeName: string, items: AromaMatchResult[] }
  matchesContext = null,
  // Opens the Wine Lab's matches for an ingredient list (App.handleFindWine).
  onFindWine = null,
  onExitMatches = () => {},
  onBackToRecipe = null,
  // The cook's account: the profile hook (saveInvention / deleteInvention, profile.sauces)
  // and { user, loginWithGoogle, loginWithApple, authError }. Absent = no saving, lists as before.
  userProfile = null,
  auth = null,
}) {
  const [codexRaw, setCodexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSauce, setSelectedSauce] = useState(null);
  // The cook's own sauces (profile.sauces), merged into the codex for the list, the card and the pantry.
  const save = useSaveInvention({ kind: 'sauce', userProfile, auth });
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const profileData = userProfile?.profile || null;
  const savedSauces = useMemo(() => readSaved(profileData, 'sauce'), [profileData]);
  const codexData = useMemo(
    () => withSavedSauces(codexRaw, savedSauces, { catMap: codexRaw ? buildCategoryMap(codexRaw.ingredientMeta || []) : null }),
    [codexRaw, savedSauces],
  );
  const [filterFamily, setFilterFamily] = useState(null);
  const [filterCuisine, setFilterCuisine] = useState(null);
  // My pantry (the shared kitchen list, also edited by Make a recipe) +
  // the pantry / Invent panels. `returnPanel`: the panel a sauce card was
  // opened from, reopened when the card closes.
  const [kitchen, setKitchen] = useState(() => loadKitchen());
  const [assumeBasics, setAssumeBasics] = useState(() => loadAssumeBasics());
  const [spiceRack, setSpiceRack] = useState(() => loadSpiceRack());
  const [panel, setPanel] = useState(null); // null | 'pantry' | 'invent'
  const [returnPanel, setReturnPanel] = useState(null);
  const updateKitchen = (next) => { setKitchen(next); saveKitchen(next); };
  const updateAssumeBasics = (on) => { setAssumeBasics(on); saveAssumeBasics(on); };
  const updateSpiceRack = (on) => { setSpiceRack(on); saveSpiceRack(on); };
  // Re-read on open: Make a recipe edits the same list.
  // "✨ Invent this" seed (from the search box); any other way into Invent starts fresh.
  const [inventSeed, setInventSeed] = useState(null);
  const openPanel = (which) => { setKitchen(loadKitchen()); setAssumeBasics(loadAssumeBasics()); setSpiceRack(loadSpiceRack()); setPanel(which); };
  // Edit / Delete on a card for one of the cook's own sauces (never on codex sauces).
  const savedActions = (sauce) => (sauce?.mine && userProfile?.deleteInvention ? [
    { label: '✏️ Edit', testid: 'saved-edit', onClick: () => {
      const item = savedSauces.find((x) => x.id === sauce.savedId);
      if (!item) return;
      setEditItem({ id: item.id, ...fromSavedItem(item) });
      setInventSeed(null);
      setReturnPanel(null);
      setSelectedSauce(null);
      openPanel('invent');
    } },
    { label: '🗑 Delete', testid: 'saved-delete', onClick: () => setConfirmDelete({ id: sauce.savedId, name: sauce.name }) },
  ] : []);
  // "What do I need?" on a sauce card, against the same kitchen list.
  const sauceNeeds = (sauce) => (
    <WhatDoINeed
      title={sauce.name}
      needs={needsFromKitchen(sauce.ingredientsDetailed?.length ? sauce.ingredientsDetailed : sauce.ingredients, kitchen, { assumeBasics, spiceRack })}
      stockEmpty={kitchen.length === 0}
      onHave={(name) => updateKitchen(addToKitchen(kitchen, name, new Set()))}
      color={familyForSelected?.color}
    />
  );

  // Apply Build → Lab pre-filter on mount.
  useEffect(() => {
    if (!externalFilter) return;
    if (externalFilter.family) setFilterFamily(externalFilter.family);
    if (externalFilter.cuisine) setFilterCuisine(externalFilter.cuisine);
  }, [externalFilter]);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      try {
        const codex = await loadSauceCodex();
        const positions = computeSauceCodexPositions(codex.nodes, codex.codex.clusters);
        if (cancelled) return;
        setCodexData({
          graph: {
            nodes: codex.nodes,
            edges: codex.edges,
            ingredientList: codex.ingredientList,
          },
          positions,
          ingredientToSauces: codex.ingredientToSauces,
          codex: codex.codex,
          // Sauce-ingredient catalogue + curated pairings (pantry / Invent).
          ingredientMeta: codex.ingredientMeta || [],
          pairings: codex.pairings || [],
        });
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    build();
    return () => { cancelled = true; };
  }, []);

  // Selection → parent (kept for parity with CocktailLab; App.jsx no
  // longer uses this for the Recipe Lab handoff, but ingredient
  // panels and other consumers still read selectedNodes).
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedSauce ? [selectedSauce] : []);
  }, [selectedSauce, onSelectionChange]);

  // Similar sauces by Jaccard edge weight (within the same family).
  const similarSauces = useMemo(() => {
    if (!selectedSauce || !codexData) return [];
    const sims = [];
    const familyById = new Map(codexData.codex.clusters.map(c => [c.id, c]));
    for (const e of codexData.graph.edges) {
      if (e.kind !== 'jaccard') continue;
      let other = null;
      if (e.source === selectedSauce) other = e.target;
      else if (e.target === selectedSauce) other = e.source;
      if (!other) continue;
      const node = codexData.graph.nodes.get(other);
      if (!node) continue;
      sims.push({
        name: other,
        similarity: e.strength,
        family_id: node.family_id,
        color: familyById.get(node.family_id)?.color || '#888',
      });
    }
    sims.sort((a, b) => b.similarity - a.similarity);
    return sims.slice(0, 8);
  }, [selectedSauce, codexData]);

  const familyForSelected = useMemo(() => {
    if (!selectedSauce || !codexData) return null;
    const node = codexData.graph.nodes.get(selectedSauce);
    if (!node) return null;
    return codexData.codex.clusters.find(c => c.id === node.family_id) || null;
  }, [selectedSauce, codexData]);

  // Pantry / Invent context: the sauce list, the sauce-ingredient catalogue
  // (roles), names for resolving what the cook types, and two pairing
  // indexes — recipe co-occurrence (ProData graph) + curated sauce pairings.
  // The recipe co-occurrence index also carries the everyday pairs the
  // curated graph lacks (garlic|olive oil, lemon|garlic …), max per pair
  // (WEAK-A); without the everyday file it is the curated graph alone.
  const everyday = useEverydayPairs();
  const pantryCtx = useMemo(() => {
    const meta = codexData?.ingredientMeta || [];
    const catalogueNames = new Set(meta.map((i) => String(i.name || '').toLowerCase()).filter(Boolean));
    const graphNodes = fullData?.graph?.nodes;
    const graphEdges = fullData?.graph?.edges;
    const kitchenNames = new Set([...catalogueNames, ...(graphNodes ? graphNodes.keys() : [])]);
    return {
      sauces: codexData ? [...codexData.graph.nodes.values()] : [],
      catMap: buildCategoryMap(meta),
      catalogueNames,
      kitchenNames,
      pairingIndex: blendIndex(graphNodes && graphEdges ? buildPairingIndex(graphEdges, graphNodes.keys()) : null, everyday),
      sauceIndex: codexData?.pairings ? buildPairingIndex(codexData.pairings, catalogueNames) : null,
    };
  }, [codexData, fullData, everyday]);

  const savedNotices = (
    <>
      <InventSaveOverlay save={save} auth={auth} />
      {confirmDelete && (
        <SavedDeleteConfirm
          name={confirmDelete.name}
          noun="sauces"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            userProfile?.deleteInvention?.('sauce', confirmDelete.id);
            setConfirmDelete(null);
            setSelectedSauce(null);
          }}
        />
      )}
    </>
  );

  // aria-live announcement when matchesContext becomes active.
  const prevMatchesRef = useRef(null);
  const [liveMsg, setLiveMsg] = useState('');
  useEffect(() => {
    if (matchesContext && prevMatchesRef.current === null) {
      setLiveMsg(
        `Showing ${matchesContext.items.length} sauces matched to ${matchesContext.recipeName}`,
      );
    } else if (!matchesContext) {
      setLiveMsg('');
    }
    prevMatchesRef.current = matchesContext;
  }, [matchesContext]);

  // ── Matches mode — replaces the full browse view entirely ──────────
  // Short-circuit BEFORE loading/error guards: the card list renders
  // purely from matchesContext.items and needs no codex data.
  if (matchesContext !== null) {
    // Detail wins over the deck: selecting a sauce ("View sauce") opens its
    // LabNodeCard detail; closing the detail returns to the deck. The deck and
    // the detail never render simultaneously.
    const detailSauce = selectedSauce && codexData
      ? codexData.graph.nodes.get(selectedSauce)
      : null;
    return (
      <div className="absolute inset-0 overflow-hidden bg-neural-bg text-neural-text" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* aria-live region for screen-reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">{liveMsg}</div>

        {selectedSauce ? (
          <LabNodeCard
            kind="sauce"
            name={detailSauce?.name || selectedSauce}
            clusterName={familyForSelected?.name || (detailSauce?.mine ? 'Uncategorised' : undefined)}
            clusterColor={familyForSelected?.color || '#9a8f7a'}
            clusterTag={detailSauce?.mine ? 'YOURS' : (detailSauce?.isRoot ? 'MOTHER' : (detailSauce?.cuisine || null))}
            actions={savedActions(detailSauce)}
            details={detailSauce ? [{ label: 'Cuisine', value: detailSauce.cuisine }] : []}
            ingredients={detailSauce?.ingredientsDetailed?.length ? detailSauce.ingredientsDetailed : (detailSauce?.ingredients || [])}
            prep={detailSauce?.instructions || ''}
            likeThis={similarSauces}
            pairsWith={detailSauce?.pairsWith || []}
            onSelect={(name) => setSelectedSauce(name)}
            onClose={() => setSelectedSauce(null)}
          >
            <DishStory kind="sauce" storyKey={detailSauce?.name || selectedSauce} name={detailSauce?.name || selectedSauce} />
            {detailSauce && sauceNeeds(detailSauce)}
            {detailSauce && (
              <SaucePairings sauce={detailSauce} color={familyForSelected?.color} onFindWine={onFindWine}
                categoryOf={(n) => fullData?.graph?.nodes?.get?.(n)?.category || null} />
            )}
          </LabNodeCard>
        ) : (
          <SauceSuggestionDeck
            items={matchesContext.items}
            recipeName={matchesContext.recipeName}
            nodes={fullData?.graph?.nodes}
            onSelectSauce={(name) => setSelectedSauce(name)}
            onBackToRecipe={onBackToRecipe}
            onClose={onExitMatches}
          />
        )}
        {savedNotices}
      </div>
    );
  }

  if (loading) {
    return (
      <ChalkLoader label="Warming the sauce pots…" color="#fb923c" />
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to load sauce codex</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const pickFromPanel = (name) => { setReturnPanel(panel); setPanel(null); setSelectedSauce(name); };
  const closeCard = () => {
    setSelectedSauce(null);
    if (returnPanel) { setPanel(returnPanel); setReturnPanel(null); }
  };

  const inventSeedFor = (query) => sauceSeedFromSearch(query, {
    sauces: pantryCtx.sauces, catMap: pantryCtx.catMap, names: pantryCtx.catalogueNames, filterFamily, filterCuisine,
  });

  return (
    <>
      <SauceBrowse
        codexData={codexData}
        selectedSauce={selectedSauce}
        onSelectSauce={(name) => setSelectedSauce(name)}
        filterFamily={filterFamily}
        onFilterFamily={setFilterFamily}
        filterCuisine={filterCuisine}
        onFilterCuisine={setFilterCuisine}
        pantryCount={kitchen.length}
        onOpenPantry={() => openPanel('pantry')}
        onOpenInvent={() => { setInventSeed(null); setEditItem(null); openPanel('invent'); }}
        onInventThis={(q) => {
          const res = inventSeedFor(q);
          if (res) { setInventSeed(res.seed); setEditItem(null); openPanel('invent'); }
        }}
        inventSummary={(q) => inventSeedFor(q)?.summary || ''}
      />

      {panel === 'pantry' && (
        <SaucePantryPanel
          kitchen={kitchen}
          onChange={updateKitchen}
          assumeBasics={assumeBasics}
          onAssumeBasicsChange={updateAssumeBasics}
          spiceRack={spiceRack}
          onSpiceRackChange={updateSpiceRack}
          sauces={pantryCtx.sauces}
          families={codexData.codex.clusters}
          names={pantryCtx.kitchenNames}
          coverNames={pantryCtx.catalogueNames}
          catMap={pantryCtx.catMap}
          pairingIndex={pantryCtx.pairingIndex}
          sauceIndex={pantryCtx.sauceIndex}
          onSelectSauce={pickFromPanel}
          onInvent={() => { setInventSeed(null); setEditItem(null); setPanel('invent'); }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'invent' && (
        <InventSauce
          key={editItem ? `edit-${editItem.id}` : (inventSeed ? 'seeded' : 'plain')}
          seed={inventSeed}
          nodes={fullData?.graph?.nodes}
          onSave={save.onSave}
          editItem={editItem}
          kitchen={kitchen}
          assumeBasics={assumeBasics}
          sauces={pantryCtx.sauces}
          families={codexData.codex.clusters}
          meta={codexData.ingredientMeta || []}
          catMap={pantryCtx.catMap}
          names={pantryCtx.catalogueNames}
          pairingIndex={pantryCtx.pairingIndex}
          sauceIndex={pantryCtx.sauceIndex}
          categoryOf={(n) => fullData?.graph?.nodes?.get?.(n)?.category || null}
          onClose={() => { save.cancelPending(); setEditItem(null); setPanel(null); }}
          onSelectSauce={pickFromPanel}
          onOpenRecipeLab={onOpenRecipeLab ? (names) => onOpenRecipeLab('sauce', names) : null}
        />
      )}

      {selectedSauce && (() => {
        const s = codexData.graph.nodes.get(selectedSauce);
        return (
          <LabNodeCard
            kind="sauce"
            name={s?.name || selectedSauce}
            clusterName={familyForSelected?.name || (s?.mine ? 'Uncategorised' : undefined)}
            clusterColor={familyForSelected?.color || '#9a8f7a'}
            clusterTag={s?.mine ? 'YOURS' : (s?.isRoot ? 'MOTHER' : (s?.cuisine || null))}
            actions={savedActions(s)}
            details={s ? [{ label: 'Cuisine', value: s.cuisine }] : []}
            ingredients={s?.ingredientsDetailed?.length ? s.ingredientsDetailed : (s?.ingredients || [])}
            prep={s?.instructions || ''}
            likeThis={similarSauces}
            pairsWith={s?.pairsWith || []}
            onSelect={(name) => setSelectedSauce(name)}
            onClose={closeCard}
          >
            <DishStory kind="sauce" storyKey={s?.name || selectedSauce} name={s?.name || selectedSauce} />
            {s && sauceNeeds(s)}
            {s && (
              <SaucePairings sauce={s} color={familyForSelected?.color} onFindWine={onFindWine}
                categoryOf={(n) => fullData?.graph?.nodes?.get?.(n)?.category || null} />
            )}
          </LabNodeCard>
        );
      })()}

      {savedNotices}

      {/* Card mode (LabNodeCard) is a full-screen overlay with its own
          Back button, so the floating Clear-Selection button is gone. */}
    </>
  );
}

// Strip the "odor_" prefix and capitalize for display. 2026-05-27
// (batch 6 chef-vocab): odor_fatty → "Creamy" (renamed). Other odor
// columns keep their lowercase-suffix→Capitalized mapping.
const AROMA_DISPLAY_OVERRIDES = {
  odor_fatty: 'Creamy',
  fatty:      'Creamy',
};
function formatAromaKey(key) {
  if (AROMA_DISPLAY_OVERRIDES[key]) return AROMA_DISPLAY_OVERRIDES[key];
  const stripped = (key || '').replace(/^odor_/, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
