import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NetworkScene from './NetworkScene.jsx';
import LabNodeCard from './LabNodeCard.jsx';
import SauceBrowse from './SauceBrowse.jsx';
import {
  loadSauceCodex,
  computeSauceCodexPositions,
} from '../data/sauceCodex.js';
import { createClusterLabels, createGlowSprite } from '../three/AxisLabels.js';
import ClusterJoystick from './ClusterJoystick.jsx';
import ShapeLegend from './ShapeLegend.jsx';
import { SAUCE_SHAPE_LEGEND } from '../data/sauceShapes.js';
import { formatSimilarityBadge } from '../data/recipeAromaSimilarity.js';
import SauceSuggestionDeck from './SauceSuggestionDeck.jsx';

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
  onExitMatches = () => {},
  onBackToRecipe = null,
}) {
  const [codexData, setCodexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [filterFamily, setFilterFamily] = useState(null);
  const [filterCuisine, setFilterCuisine] = useState(null);

  // Apply Build → Lab pre-filter on mount.
  useEffect(() => {
    if (!externalFilter) return;
    if (externalFilter.family) setFilterFamily(externalFilter.family);
    if (externalFilter.cuisine) setFilterCuisine(externalFilter.cuisine);
  }, [externalFilter]);
  // Camera fly-to target for the family fly-wheel (R10-66).
  const [flyToTarget, setFlyToTarget] = useState(null);
  // Explore = the 3D NetworkScene (existing). Browse = 2D mini-map +
  // sectioned list. Detail panel + selection state are shared.
  const [viewMode, setViewMode] = useState('explore');

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

  // Per-family centroid — used by both the 3D label sprites and the
  // fly-wheel onFlyTo handler. Pulled out of sceneExtras so the
  // joystick can resolve a target position without rebuilding labels.
  const familyCentroids = useMemo(() => {
    if (!codexData) return null;
    const centroids = new Map();
    for (const fam of codexData.codex.clusters) {
      const rootName = [...codexData.graph.nodes.values()]
        .find(n => n.isRoot && n.family_id === fam.id)?.name;
      if (rootName) {
        centroids.set(fam.id, codexData.positions.positions[rootName]);
      } else {
        const first = [...codexData.graph.nodes.values()].find(n => n.family_id === fam.id);
        if (first) centroids.set(fam.id, codexData.positions.positions[first.name]);
      }
    }
    return centroids;
  }, [codexData]);

  const familyMemberCount = useMemo(() => {
    if (!codexData) return null;
    const counts = new Map();
    for (const n of codexData.graph.nodes.values()) {
      counts.set(n.family_id, (counts.get(n.family_id) || 0) + 1);
    }
    return counts;
  }, [codexData]);

  // R14 camera-animations adapter — a stable closure over
  // familyCentroids. Memoized so NetworkScene's mount effect doesn't
  // re-run on every render.
  const sauceCentroidAdapter = useMemo(() => {
    if (!familyCentroids) return null;
    return () => {
      const out = [];
      for (const [id, position] of familyCentroids) {
        if (Array.isArray(position) && position.length >= 3) {
          out.push({ id, position });
        }
      }
      return out;
    };
  }, [familyCentroids]);

  // R14 multi-shape: extract `shapeKey` per sauce from the codex nodes
  // (set in sauceCodex.js → sauceShapeKey() based on the cuisine field).
  // Memoized so the NetworkScene's init effect doesn't tear down + rebuild
  // on every render.
  const shapeAssignments = useMemo(() => {
    if (!codexData?.graph?.nodes) return null;
    const m = new Map();
    for (const [name, node] of codexData.graph.nodes) {
      if (node.shapeKey) m.set(name, node.shapeKey);
    }
    return m.size > 0 ? m : null;
  }, [codexData]);

  // 3D cluster labels + Cultural Root glow halos. Mother sauces sit
  // at each family's centroid; the glow makes them obvious as the
  // anchor of their cluster at any zoom level.
  const sceneExtras = useMemo(() => {
    if (!codexData || !familyCentroids) return null;
    const clusters = codexData.codex.clusters.map(c => ({
      id: c.id,
      label: c.name,
      color: c.color,
    }));
    const labels = createClusterLabels(clusters, familyCentroids);
    const positions = codexData.positions?.positions || {};
    for (const c of clusters) {
      const cid = c.id;
      // Find this family's root sauce (mother sauce / cluster anchor)
      let rootName = null;
      for (const [name, n] of codexData.graph.nodes) {
        if (n.family_id === cid && n.isRoot) { rootName = name; break; }
      }
      const pos = rootName ? positions[rootName] : null;
      if (pos) labels.add(createGlowSprite(pos, c.color, 14));
    }
    return labels;
  }, [codexData, familyCentroids]);

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

  // Family filter — when active, NetworkScene highlights only that
  // family's sauces (uses the existing treeFilterIngredients hook).
  const familyFilteredNames = useMemo(() => {
    if (filterFamily == null || !codexData) return null;
    const names = [];
    for (const [name, n] of codexData.graph.nodes) {
      if (n.family_id === filterFamily) names.push(name);
    }
    return names.length > 0 ? names : null;
  }, [filterFamily, codexData]);

  // Cuisine-shape filter (ShapeLegend now acts as a fly-to wheel).
  // Maps selected cuisine ('French') → its shape ('cube') → all sauces
  // whose cuisine-shape matches.
  const cuisineFilteredNames = useMemo(() => {
    if (!filterCuisine || !codexData) return null;
    const target = SAUCE_SHAPE_LEGEND.find((l) => l.category === filterCuisine)?.shape;
    if (!target) return null;
    const names = [];
    for (const [name, n] of codexData.graph.nodes) {
      if (n.shapeKey === target) names.push(name);
    }
    return names.length > 0 ? names : null;
  }, [filterCuisine, codexData]);

  const combinedFilterNames = useMemo(() => {
    if (familyFilteredNames && cuisineFilteredNames) {
      const set = new Set(cuisineFilteredNames);
      const inter = familyFilteredNames.filter((n) => set.has(n));
      return inter.length > 0 ? inter : null;
    }
    return familyFilteredNames || cuisineFilteredNames;
  }, [familyFilteredNames, cuisineFilteredNames]);

  const handleNodeClick = useCallback((node) => {
    if (!node) return; // empty-space click no longer dismisses
    setSelectedSauce(node.name);
  }, []);

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
          />
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
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-amber-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-amber-400/50 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[30%] bg-amber-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm">Building sauce codex...</p>
        </div>
      </div>
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

  return (
    <>
      {/* Explore (3D) ↔ Browse (2D) toggle. Same pattern as
          CocktailLabV2; lab-local state. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 p-0.5 rounded-lg bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e]"
        style={{ top: 'calc(var(--nav-h, 4.5rem) + 0.5rem)' }}
      >
        {[
          { id: 'explore', label: 'Explore (3D)' },
          { id: 'browse',  label: 'Browse (2D)' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setViewMode(m.id)}
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
              viewMode === m.id
                ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/40'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {viewMode === 'explore' ? (
        <NetworkScene
          data={codexData}
          onNodeClick={handleNodeClick}
          onNodeHover={() => {}}
          selectedNode={selectedSauce}
          selectedNodes={selectedSauce ? [selectedSauce] : []}
          showEdges={true}
          showParticles={true}
          filterCuisine=""
          filterTaste=""
          profileWeights={null}
          treeFilterIngredients={combinedFilterNames}
          sceneExtras={sceneExtras}
          showNodeLabels={true}
          labelNodeNames={familyFilteredNames}
          flyToTarget={flyToTarget}
          shapeAssignments={shapeAssignments}
          scaleMultiplier={3.0}
          centroidAdapter={sauceCentroidAdapter}
          disableClusterTour={true}
        />
      ) : (
        <SauceBrowse
          codexData={codexData}
          selectedSauce={selectedSauce}
          onSelectSauce={(name) => setSelectedSauce(name)}
          filterFamily={filterFamily}
          onFilterFamily={setFilterFamily}
          filterCuisine={filterCuisine}
          onFilterCuisine={setFilterCuisine}
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
            onClose={() => setSelectedSauce(null)}
          />
        );
      })()}

      {/* Card mode (LabNodeCard) is a full-screen overlay with its own
          Back button, so the floating Clear-Selection button is gone. */}

      {/* ClusterJoystick + ShapeLegend are 3D-scene affordances —
          Browse view has its own family bubbles + cuisine chips. */}
      {viewMode === 'explore' && (
        <ClusterJoystick
          clusters={codexData.codex.clusters}
          mode="ml"
          focusedClusterId={filterFamily}
          onClusterFocus={(id) => setFilterFamily(id)}
          onFlyTo={(family) => {
            const pos = familyCentroids?.get(family.id);
            if (!pos) return;
            setFlyToTarget({
              position: pos,
              memberCount: familyMemberCount?.get(family.id) || 1,
              ts: Date.now(),
            });
          }}
        />
      )}

      {viewMode === 'explore' && (
        <ShapeLegend
          title="Cuisine shapes"
          legend={SAUCE_SHAPE_LEGEND}
          selectedKey={filterCuisine}
          onSelect={setFilterCuisine}
        />
      )}
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
