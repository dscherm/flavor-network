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
import { loadKitchen, saveKitchen, loadAssumeBasics, saveAssumeBasics, addToKitchen } from '../data/myKitchen.js';
import WhatDoINeed from './WhatDoINeed.jsx';
import { needsFromKitchen } from '../data/whatDoINeed.js';
import { buildCategoryMap } from '../data/saucePantry.js';
import { buildPairingIndex } from '../data/recipePairingMatch.js';
import { blendIndex } from '../data/everydayPairs.js';
import useEverydayPairs from '../hooks/useEverydayPairs.js';

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
}) {
  const [codexData, setCodexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [filterFamily, setFilterFamily] = useState(null);
  const [filterCuisine, setFilterCuisine] = useState(null);
  // My pantry (the shared kitchen list, also edited by Make a recipe) +
  // the pantry / Invent panels. `returnPanel`: the panel a sauce card was
  // opened from, reopened when the card closes.
  const [kitchen, setKitchen] = useState(() => loadKitchen());
  const [assumeBasics, setAssumeBasics] = useState(() => loadAssumeBasics());
  const [panel, setPanel] = useState(null); // null | 'pantry' | 'invent'
  const [returnPanel, setReturnPanel] = useState(null);
  const updateKitchen = (next) => { setKitchen(next); saveKitchen(next); };
  const updateAssumeBasics = (on) => { setAssumeBasics(on); saveAssumeBasics(on); };
  // Re-read on open: Make a recipe edits the same list.
  const openPanel = (which) => { setKitchen(loadKitchen()); setAssumeBasics(loadAssumeBasics()); setPanel(which); };
  // "What do I need?" on a sauce card, against the same kitchen list.
  const sauceNeeds = (sauce) => (
    <WhatDoINeed
      title={sauce.name}
      needs={needsFromKitchen(sauce.ingredientsDetailed?.length ? sauce.ingredientsDetailed : sauce.ingredients, kitchen, { assumeBasics })}
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
      <div className="absolute inset-0 overflow-hidden bg-neural-bg text-neural-text">
        {/* aria-live region for screen-reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">{liveMsg}</div>

        {selectedSauce ? (
          <LabNodeCard
            kind="sauce"
            name={detailSauce?.name || selectedSauce}
            clusterName={familyForSelected?.name}
            clusterColor={familyForSelected?.color || '#9a8f7a'}
            clusterTag={detailSauce?.isRoot ? 'MOTHER' : (detailSauce?.cuisine || null)}
            details={detailSauce ? [{ label: 'Cuisine', value: detailSauce.cuisine }] : []}
            ingredients={detailSauce?.ingredientsDetailed?.length ? detailSauce.ingredientsDetailed : (detailSauce?.ingredients || [])}
            prep={detailSauce?.instructions || ''}
            likeThis={similarSauces}
            pairsWith={detailSauce?.pairsWith || []}
            onSelect={(name) => setSelectedSauce(name)}
            onClose={() => setSelectedSauce(null)}
          >
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
        onOpenInvent={() => openPanel('invent')}
      />

      {panel === 'pantry' && (
        <SaucePantryPanel
          kitchen={kitchen}
          onChange={updateKitchen}
          assumeBasics={assumeBasics}
          onAssumeBasicsChange={updateAssumeBasics}
          sauces={pantryCtx.sauces}
          families={codexData.codex.clusters}
          names={pantryCtx.kitchenNames}
          coverNames={pantryCtx.catalogueNames}
          catMap={pantryCtx.catMap}
          pairingIndex={pantryCtx.pairingIndex}
          sauceIndex={pantryCtx.sauceIndex}
          onSelectSauce={pickFromPanel}
          onInvent={() => setPanel('invent')}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'invent' && (
        <InventSauce
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
          onClose={() => setPanel(null)}
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
            clusterName={familyForSelected?.name}
            clusterColor={familyForSelected?.color || '#9a8f7a'}
            clusterTag={s?.isRoot ? 'MOTHER' : (s?.cuisine || null)}
            details={s ? [{ label: 'Cuisine', value: s.cuisine }] : []}
            ingredients={s?.ingredientsDetailed?.length ? s.ingredientsDetailed : (s?.ingredients || [])}
            prep={s?.instructions || ''}
            likeThis={similarSauces}
            pairsWith={s?.pairsWith || []}
            onSelect={(name) => setSelectedSauce(name)}
            onClose={closeCard}
          >
            {s && sauceNeeds(s)}
            {s && (
              <SaucePairings sauce={s} color={familyForSelected?.color} onFindWine={onFindWine}
                categoryOf={(n) => fullData?.graph?.nodes?.get?.(n)?.category || null} />
            )}
          </LabNodeCard>
        );
      })()}

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
